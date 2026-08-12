import { buscarVoo, paraTimestamp } from "./voos.mock.js";
import { curto, dataHora, duracao } from "../lib/formato.js";

/**
 * Oráculo do AcordoInstant.
 *
 * É a fonte de dados externa da proposta: fica fora da blockchain, conhece o
 * horário real de chegada de cada voo (oracle/voos.mock.js) e é a única
 * conta autorizada pelo contrato a escrever esse número on-chain. Nem a
 * companhia nem o passageiro conseguem informar o atraso — o parâmetro do
 * seguro entra por aqui e só por aqui.
 *
 * A apuração é automática: como a base já tem o horário real, o serviço
 * varre os voos cadastrados no contrato e reporta os que ainda estão
 * pendentes, o que dispara a execução do contrato na mesma transação
 * (indenizar os passageiros ou devolver a garantia à companhia).
 */
export function criarOraculo({ acesso, log, janelaEmbarqueSegundos = 15 }) {
  const contrato = acesso.leitura;
  let temporizador = null;
  let apurando = false;

  /**
   * Instante do último bilhete embarcado no voo, lido da própria cadeia.
   *
   * Serve para respeitar a janela de embarque: assim que o oráculo apura um
   * voo, o contrato passa a recusar novos bilhetes, então apurar no mesmo
   * segundo em que o primeiro passageiro é registrado impediria a companhia
   * de embarcar o segundo.
   */
  async function ultimoEmbarqueEm(vooId) {
    const registros = await contrato.queryFilter(contrato.filters.BilheteRegistrado(null, vooId));
    if (registros.length === 0) return null;

    const ultimo = registros[registros.length - 1];
    const bloco = await acesso.provedor.getBlock(ultimo.blockNumber);
    return bloco?.timestamp ?? null;
  }

  /** Voos cadastrados no contrato que ainda não foram apurados. */
  async function pendentes() {
    const ids = await contrato.listarTodosOsVoos();
    const lista = [];

    for (const vooId of ids) {
      const voo = await contrato.consultarVoo(vooId);
      // 0 = Agendado. Sem bilhete não há o que executar.
      if (Number(voo.status) !== 0 || Number(voo.totalBilhetes) === 0) continue;
      lista.push({ vooId, codigo: voo.codigo, chegadaPrevista: voo.chegadaPrevista });
    }

    return lista;
  }

  /**
   * Apura um voo: lê a chegada real na base e escreve no contrato.
   * @returns {Promise<{codigo: string, atrasoMinutos: number, atrasado: boolean}|null>}
   */
  async function apurar(codigo) {
    const dados = buscarVoo(codigo);

    if (!dados) {
      log.aviso(`voo ${codigo} nao existe na base do oraculo — nada a reportar`);
      return null;
    }

    const chegadaReal = paraTimestamp(dados.chegadaReal);
    const transacao = await acesso.comoOraculo.reportarChegada(codigo, chegadaReal);
    await transacao.wait();

    const voo = await contrato.consultarVoo(await contrato.idDoVoo(codigo));
    const atraso = Number(voo.atrasoMinutos);

    return { codigo, atrasoMinutos: atraso, atrasado: Number(voo.status) === 2 };
  }

  /** Uma rodada de apuração: reporta todos os voos pendentes já embarcados. */
  async function apurarPendentes() {
    if (apurando) return [];
    apurando = true;

    const apurados = [];

    try {
      const lista = await pendentes();
      if (lista.length === 0) return apurados;

      // O relógio de referência é o do sistema, não o do último bloco: a
      // rede local só avança `block.timestamp` quando mina, então uma rede
      // parada deixaria a janela de embarque aberta para sempre.
      const agora = Math.floor(Date.now() / 1000);

      for (const voo of lista) {
        const embarque = await ultimoEmbarqueEm(voo.vooId);
        if (embarque !== null && agora - embarque < janelaEmbarqueSegundos) {
          continue; // embarque ainda aberto
        }

        const resultado = await apurar(voo.codigo);
        if (resultado) apurados.push(resultado);
      }
    } catch (erro) {
      log.erro(`oraculo: ${erro.message}`);
    } finally {
      apurando = false;
    }

    return apurados;
  }

  return {
    apurar,
    apurarPendentes,
    pendentes,

    async iniciar(intervaloSegundos = 8) {
      log.evento({
        rotulo: "ORACULO ATIVO",
        cor: "magenta",
        resumo:
          `conta ${curto(acesso.enderecoDoOraculo)} · verificando voos a cada ` +
          `${intervaloSegundos}s · janela de embarque ${janelaEmbarqueSegundos}s`,
        detalhes: ["fonte: oracle/voos.mock.js (horario real de chegada)"]
      });

      await apurarPendentes();
      temporizador = setInterval(apurarPendentes, intervaloSegundos * 1000);
      temporizador.unref?.();
    },

    parar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = null;
    }
  };
}

/** Descrição textual de um voo da base, usada em telas e relatórios. */
export function descreverVoo(dados) {
  const atraso = paraTimestamp(dados.chegadaReal) - paraTimestamp(dados.chegadaPrevista);
  const minutos = atraso > 0 ? Math.floor(atraso / 60) : 0;

  return (
    `${dados.codigo} ${dados.origem}→${dados.destino} · ` +
    `prevista ${dataHora(paraTimestamp(dados.chegadaPrevista))} · ` +
    `real ${dataHora(paraTimestamp(dados.chegadaReal))} · atraso ${duracao(minutos)}`
  );
}
