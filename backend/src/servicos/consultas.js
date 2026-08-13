import { buscarVoo } from "../../../oracle/voos.mock.js";
import { brl, curto, duracao } from "../../../lib/formato.js";

/**
 * Leitura da cadeia para os três painéis.
 *
 * Tudo o que vira número ou status vem do contrato, que é a versão que o TJPB
 * auditaria. O que vem da base do oráculo (rota, aeroportos, nome comercial
 * da companhia) é só contexto de exibição, e está marcado como tal.
 */

export const STATUS_VOO = ["Agendado", "Pontual", "Atrasado"];
export const STATUS_BILHETE = ["Ativo", "Indenizado", "GarantiaLiberada"];

/** Traduz o status do voo para o texto exibido nos painéis. */
export function rotuloDoVoo(status, atrasoMinutos) {
  const indice = Number(status);
  if (indice === 0) return "Aguardando oraculo";
  if (indice === 2) return `Atrasado ${duracao(atrasoMinutos)}`;
  return Number(atrasoMinutos) > 0 ? `No prazo (atraso de ${duracao(atrasoMinutos)})` : "Pontual";
}

export function criarConsultas({ acesso, manifesto }) {
  const contrato = acesso.leitura;

  async function montarBilhete(bilheteId, indicePorHash) {
    const bilhete = await contrato.consultarBilhete(bilheteId);
    const pessoa = indicePorHash?.get(bilhete.hashCpf) ?? null;
    const statusIndice = Number(bilhete.status);

    return {
      id: bilhete.id,
      idCurto: curto(bilhete.id),
      hashCpf: bilhete.hashCpf,
      hashCpfCurto: curto(bilhete.hashCpf),
      // Vem do manifesto off-chain da companhia; a cadeia não guarda nome.
      passageiro: pessoa?.nome ?? null,
      garantiaWei: bilhete.garantia.toString(),
      garantia: brl(bilhete.garantia),
      status: STATUS_BILHETE[statusIndice] ?? "Desconhecido",
      indenizado: statusIndice === 1,
      garantiaDevolvida: statusIndice === 2,
      quitadoEm: Number(bilhete.quitadoEm) || null
    };
  }

  async function montarVoo(vooId, { comBilhetes = true, indicePorHash = null } = {}) {
    const voo = await contrato.consultarVoo(vooId);
    const referencia = buscarVoo(voo.codigo);
    const statusIndice = Number(voo.status);
    const atrasoMinutos = Number(voo.atrasoMinutos);

    const base = {
      id: vooId,
      codigo: voo.codigo,
      companhia: voo.companhia,
      partidaPrevista: Number(voo.partidaPrevista),
      chegadaPrevista: Number(voo.chegadaPrevista),
      chegadaReal: Number(voo.chegadaReal) || null,
      atrasoMinutos,
      atraso: duracao(atrasoMinutos),
      status: STATUS_VOO[statusIndice] ?? "Desconhecido",
      statusRotulo: rotuloDoVoo(statusIndice, atrasoMinutos),
      apurado: statusIndice !== 0,
      atrasado: statusIndice === 2,
      totalBilhetes: Number(voo.totalBilhetes),
      // Contexto da base do oráculo, fora da cadeia.
      origem: referencia?.origem ?? null,
      destino: referencia?.destino ?? null,
      operadora: referencia?.companhia ?? null
    };

    if (!comBilhetes) return base;

    const ids = await contrato.listarBilhetesDoVoo(vooId);
    const indice = indicePorHash ?? (await manifesto.indicePorHash());
    const bilhetes = [];

    for (const id of ids) {
      bilhetes.push(await montarBilhete(id, indice));
    }

    const emEscrow = bilhetes.filter((bilhete) => bilhete.status === "Ativo").length;
    const indenizados = bilhetes.filter((bilhete) => bilhete.indenizado).length;

    return {
      ...base,
      bilhetes,
      resumo: {
        emEscrow,
        indenizados,
        garantiasDevolvidas: bilhetes.filter((bilhete) => bilhete.garantiaDevolvida).length
      }
    };
  }

  async function listarVoos(ids, opcoes = {}) {
    const indice = await manifesto.indicePorHash();
    const voos = [];

    for (const id of ids) {
      voos.push(await montarVoo(id, { ...opcoes, indicePorHash: indice }));
    }

    // Mais recentes primeiro: o que acabou de ser cadastrado sobe no painel.
    return voos.reverse();
  }

  async function regra() {
    const [limiarHoras, valorWei, valorCentavos] = await contrato.regraContrato();

    return {
      limiarHoras: Number(limiarHoras),
      valorWei: valorWei.toString(),
      valor: brl(valorWei),
      valorCentavos: Number(valorCentavos),
      texto: `Atraso superior a ${limiarHoras} horas ⇒ ${brl(valorWei)} por passageiro`
    };
  }

  return { montarVoo, montarBilhete, listarVoos, regra };
}
