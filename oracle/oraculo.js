import { buscarVoo, paraTimestamp } from "./voos.mock.js";
import { curto, dataHora, duracao } from "../lib/formato.js";

/**
 * Oráculo do AcordoInstant.
 *
 * É a fonte de dados externa da proposta: fica fora da blockchain, conhece o
 * horário real de chegada de cada voo (oracle/voos.mock.js) e é a única
 * conta autorizada pelo contrato a escrever esse número on-chain. Nem a
 * companhia nem o passageiro conseguem informar o atraso: o parâmetro do
 * seguro entra por aqui e só por aqui.
 *
 * A apuração é automática: como a base já tem o horário real, o serviço
 * varre os voos cadastrados no contrato e reporta os que ainda estão
 * pendentes, o que dispara a execução do contrato na mesma transação
 * (indenizar os passageiros ou devolver a garantia à companhia).
 */
export function criarOraculo({ acesso, log, esperaSegundos = 7 }) {
  const contrato = acesso.leitura;
  let temporizador = null;
  let apurando = false;

  /** Instante de cadastro de cada voo, em ms; não muda, então vale guardar. */
  const cadastroDoVoo = new Map();

  /**
   * Marca o instante exato em que um voo foi cadastrado e agenda a apuração.
   *
   * Chamado pelo serviço da companhia logo após a transação de cadastro.
   *
   * São duas precisões diferentes em jogo. O `block.timestamp` do bloco
   * correspondente também daria o instante, mas tem granularidade de um
   * segundo e trunca a fração: um voo cadastrado em `…40.9` vira `…40`, e a
   * espera de 7 s duraria 6,1 s de relógio. E deixar a varredura periódica
   * descobrir sozinha somaria até um intervalo inteiro do outro lado. Com o
   * instante em milissegundos e um disparo agendado para o momento exato, a
   * janela fecha quando deve.
   */
  function marcarCadastro(vooId) {
    cadastroDoVoo.set(vooId, Date.now());

    const disparo = setTimeout(() => apurarPendentes(), esperaSegundos * 1000);
    disparo.unref?.();
  }

  /**
   * Momento em que a companhia cadastrou o voo, em ms.
   *
   * É a partir daqui que a espera de `esperaSegundos` é contada. O ponto de
   * referência é o cadastro do voo, e não o último bilhete: assim a janela
   * para embarcar passageiros é sempre a mesma, previsível, em vez de se
   * esticar a cada novo passageiro registrado.
   *
   * Para voos cadastrados antes de este processo subir, resta a cadeia: aí a
   * precisão de segundo inteiro basta, porque a espera já venceu há muito.
   */
  async function cadastradoEm(vooId) {
    if (cadastroDoVoo.has(vooId)) return cadastroDoVoo.get(vooId);

    const registros = await contrato.queryFilter(contrato.filters.VooCadastrado(vooId));
    if (registros.length === 0) return null;

    const bloco = await acesso.provedor.getBlock(registros[0].blockNumber);
    if (!bloco?.timestamp) return null;

    const instante = bloco.timestamp * 1000;
    cadastroDoVoo.set(vooId, instante);
    return instante;
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
      log.aviso(`voo ${codigo} nao existe na base do oraculo, nada a reportar`);
      return null;
    }

    const chegadaReal = paraTimestamp(dados.chegadaReal);
    const transacao = await acesso.comoOraculo.reportarChegada(codigo, chegadaReal);
    await transacao.wait();

    const voo = await contrato.consultarVoo(await contrato.idDoVoo(codigo));
    const atraso = Number(voo.atrasoMinutos);

    return { codigo, atrasoMinutos: atraso, atrasado: Number(voo.status) === 2 };
  }

  /**
   * Uma rodada de apuração.
   *
   * Reporta todos os voos que já passaram da espera. Um voo apurado deixa de
   * aceitar bilhetes, então a espera é o que garante à companhia uma janela
   * conhecida para embarcar os passageiros antes de o contrato executar.
   *
   * @param {boolean} [ignorarEspera] força a apuração imediata, usada pela
   *   rota manual do oráculo.
   */
  async function apurarPendentes(ignorarEspera = false) {
    if (apurando) return [];
    apurando = true;

    const apurados = [];

    try {
      const lista = await pendentes();
      if (lista.length === 0) return apurados;

      // O relógio de referência é o do sistema, e não o do último bloco: a
      // rede local só avança `block.timestamp` quando mina, então uma rede
      // parada deixaria a espera aberta para sempre.
      const agora = Date.now();
      const espera = esperaSegundos * 1000;

      for (const voo of lista) {
        if (!ignorarEspera) {
          const cadastro = await cadastradoEm(voo.vooId);
          if (cadastro !== null && agora - cadastro < espera) {
            continue; // ainda dentro da janela de embarque
          }
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
    marcarCadastro,

    /**
     * Liga a varredura periódica.
     *
     * É uma rede de segurança, não o caminho normal: quem apura no instante
     * certo é o disparo agendado em `marcarCadastro`. A varredura existe
     * para os voos que ficaram pendentes de uma execução anterior, cujo
     * agendamento se perdeu quando o processo caiu.
     */
    async iniciar(intervaloSegundos = 5) {
      log.evento({
        rotulo: "ORACULO ATIVO",
        cor: "magenta",
        resumo:
          `conta ${curto(acesso.enderecoDoOraculo)} · apura cada voo ` +
          `${esperaSegundos}s apos o cadastro`,
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
