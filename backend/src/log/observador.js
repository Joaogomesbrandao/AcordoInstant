import { CatalogoEventos, rastreio } from "../../../lib/eventos.js";
import { curto } from "../../../lib/formato.js";

/**
 * Observador da blockchain: toda movimentação vira log.
 *
 * Em vez de registrar o que o backend *pediu*, este módulo registra o que a
 * cadeia de fato *executou*: ele lê os logs do contrato bloco a bloco. A
 * diferença importa porque o oráculo roda em outro fluxo e o contrato
 * dispara pagamentos por conta própria dentro de uma única transação, e nada
 * disso apareceria se o log fosse escrito no ponto de chamada.
 *
 * No arranque o histórico é apenas indexado, sem reimprimir: reiniciar o
 * backend não deve duplicar o que já está no arquivo de log.
 */
export function criarObservador({ acesso, log, intervaloMs = 1000 }) {
  const catalogo = new CatalogoEventos();
  const contrato = acesso.leitura;
  const provedor = acesso.provedor;

  let ultimoBloco = -1;
  let temporizador = null;
  let varrendo = false;

  function interpretar(registro) {
    try {
      const descricao = contrato.interface.parseLog({
        topics: [...registro.topics],
        data: registro.data
      });
      return descricao ? { name: descricao.name, args: descricao.args } : null;
    } catch {
      return null;
    }
  }

  async function buscarEventos(de, ate) {
    const registros = await provedor.getLogs({
      address: acesso.endereco,
      fromBlock: de,
      toBlock: ate
    });

    return registros
      .map((registro) => {
        const evento = interpretar(registro);
        return evento ? { ...evento, registro } : null;
      })
      .filter(Boolean);
  }

  /** Indexa tudo o que já aconteceu, para os logs novos saírem legíveis. */
  async function indexarHistorico() {
    const atual = await provedor.getBlockNumber();
    const eventos = await buscarEventos(0, atual);

    for (const evento of eventos) {
      catalogo.indexar(evento);
    }

    ultimoBloco = atual;

    log.evento({
      rotulo: "OBSERVADOR ATIVO",
      cor: "azul",
      resumo:
        `contrato ${curto(acesso.endereco)} · ${eventos.length} evento(s) ja registrados · ` +
        `${catalogo.voos.size} voo(s) indexado(s)`,
      detalhes: [`gravando em ${log.destino}`]
    });
  }

  async function varrer() {
    if (varrendo) return;
    varrendo = true;

    try {
      const atual = await provedor.getBlockNumber();
      if (atual <= ultimoBloco) return;

      const eventos = await buscarEventos(ultimoBloco + 1, atual);
      ultimoBloco = atual;

      // O gás é do recibo, não do evento: uma transação que paga cinco
      // passageiros emite dez eventos e tem um único custo. Ele é buscado
      // uma vez e anexado só à primeira linha da transação.
      const recibos = new Map();
      const transacoes = [...new Set(eventos.map((evento) => evento.registro.transactionHash))];
      await Promise.all(
        transacoes.map(async (hash) => {
          recibos.set(hash, await provedor.getTransactionReceipt(hash).catch(() => null));
        })
      );

      const jaDetalhadas = new Set();

      for (const evento of eventos) {
        catalogo.indexar(evento);

        const linha = catalogo.traduzir(evento);
        if (!linha) continue;

        const hash = evento.registro.transactionHash;
        const detalhes = [...linha.detalhes];

        if (!jaDetalhadas.has(hash)) {
          jaDetalhadas.add(hash);
          const recibo = recibos.get(hash);
          detalhes.push(
            ...rastreio({
              txHash: hash,
              blockNumber: evento.registro.blockNumber,
              gasUsed: recibo?.gasUsed
            })
          );
        }

        log.evento({ ...linha, detalhes });
      }
    } catch (erro) {
      log.erro(`observador: ${erro.message}`);
    } finally {
      varrendo = false;
    }
  }

  return {
    catalogo,

    async iniciar() {
      await indexarHistorico();
      temporizador = setInterval(varrer, intervaloMs);
      temporizador.unref?.();
    },

    parar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = null;
    },

    /** Força uma varredura imediata (usado após ações da API). */
    varrer
  };
}
