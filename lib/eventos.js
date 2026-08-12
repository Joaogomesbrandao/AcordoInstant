import { brl, curto, dataHora, duracao, numero } from "./formato.js";

/**
 * Tradutor dos eventos do contrato para as linhas de log.
 *
 * O contrato emite identificadores (hash do voo, hash do bilhete) porque é o
 * que cabe na cadeia sem desperdício. Para o log ficar legível, esta classe
 * mantém um índice em memória — alimentado pelos próprios eventos, na ordem
 * em que ocorreram — que devolve o código do voo a partir do hash. Assim a
 * linha mostra "G31702" em vez de "0x4f2a…9c11" sem custar nada on-chain.
 */
export class CatalogoEventos {
  constructor() {
    /** @type {Map<string, string>} vooId -> código do voo */
    this.voos = new Map();
    /** @type {Map<string, {codigo: string, hashCpf: string}>} */
    this.bilhetes = new Map();
  }

  /** Indexa um evento sem produzir linha de log (usado ao ler o histórico). */
  indexar(evento) {
    if (evento.name === "VooCadastrado") {
      this.voos.set(evento.args.vooId, evento.args.codigo);
      return;
    }

    if (evento.name === "BilheteRegistrado") {
      this.bilhetes.set(evento.args.bilheteId, {
        codigo: this.voos.get(evento.args.vooId) ?? curto(evento.args.vooId),
        hashCpf: evento.args.hashCpf
      });
    }
  }

  codigoDoVoo(vooId) {
    return this.voos.get(vooId) ?? curto(vooId);
  }

  codigoDoBilhete(bilheteId) {
    return this.bilhetes.get(bilheteId)?.codigo ?? curto(bilheteId);
  }

  /**
   * Converte um evento do contrato em uma entrada de log.
   * @returns {{rotulo: string, resumo: string, detalhes: string[], cor: string}|null}
   */
  traduzir(evento) {
    const { name, args } = evento;

    switch (name) {
      case "VooCadastrado":
        return {
          rotulo: "VOO CADASTRADO",
          cor: "ciano",
          resumo:
            `${args.codigo} · partida ${dataHora(args.partidaPrevista)} · ` +
            `chegada prevista ${dataHora(args.chegadaPrevista)}`,
          detalhes: [`companhia ${curto(args.companhia)}`]
        };

      case "BilheteRegistrado":
        return {
          rotulo: "BILHETE REGISTRADO",
          cor: "azul",
          resumo:
            `${this.codigoDoVoo(args.vooId)} · passageiro ${curto(args.hashCpf)} · ` +
            `garantia ${brl(args.garantia)} em escrow`,
          detalhes: [`bilhete ${curto(args.bilheteId)}`]
        };

      case "ChegadaReportada": {
        const atrasado = Number(args.status) === 2;
        const minutos = Number(args.atrasoMinutos);

        // Um voo pode ter atrasado e ainda assim não indenizar. Chamar isso
        // de "PONTUAL" no log esconderia justamente o caso que mais gera
        // dúvida na demonstração.
        const veredito = atrasado
          ? "ATRASADO"
          : minutos > 0
            ? "ATRASO ABAIXO DO LIMITE"
            : "PONTUAL";

        return {
          rotulo: "CHEGADA REPORTADA",
          cor: atrasado ? "amarelo" : "verde",
          resumo:
            `${args.codigo} · prevista ${dataHora(args.chegadaPrevista)} · ` +
            `real ${dataHora(args.chegadaReal)} · atraso ${duracao(minutos)} · ${veredito}`,
          detalhes: [
            atrasado
              ? "regra acionada: indenizar passageiros"
              : "sem direito a indenizacao: garantias devolvidas a companhia"
          ]
        };
      }

      case "IndenizacaoDepositada":
        return {
          rotulo: "INDENIZACAO PAGA",
          cor: "verde",
          resumo:
            `${this.codigoDoBilhete(args.bilheteId)} · ${brl(args.valor)} depositados ` +
            `em ${curto(args.carteira)} · passageiro ${curto(args.hashCpf)}`,
          detalhes: []
        };

      case "IndenizacaoRetida":
        return {
          rotulo: "INDENIZACAO RETIDA",
          cor: "amarelo",
          resumo:
            `${this.codigoDoBilhete(args.bilheteId)} · ${brl(args.valor)} reservados para ` +
            `${curto(args.hashCpf)} · passageiro ainda sem cadastro`,
          detalhes: [`credito acumulado ${brl(args.creditoAcumulado)}`]
        };

      case "QuitacaoEmitida":
        return {
          rotulo: "QUITACAO EMITIDA",
          cor: "magenta",
          resumo:
            `${this.codigoDoBilhete(args.bilheteId)} · ${brl(args.valor)} · ` +
            `atraso ${duracao(args.atrasoMinutos)} · passageiro ${curto(args.hashCpf)}`,
          detalhes: [`quitacao dos danos materiais imediatos em ${dataHora(args.instante)}`]
        };

      case "GarantiaLiberadaParaCompanhia":
        return {
          rotulo: "GARANTIA DEVOLVIDA",
          cor: "verde",
          resumo:
            `${this.codigoDoBilhete(args.bilheteId)} · ${brl(args.valor)} liberados para ` +
            `${curto(args.companhia)} · atraso dentro do limite`,
          detalhes: [`saldo resgatavel ${brl(args.saldoLiberado)}`]
        };

      case "CarteiraVinculada":
        return {
          rotulo: "CARTEIRA VINCULADA",
          cor: "azul",
          resumo: `passageiro ${curto(args.hashCpf)} · carteira ${curto(args.carteira)}`,
          detalhes: ["creditos retidos serao depositados nesta carteira"]
        };

      case "GarantiaResgatada":
        return {
          rotulo: "RESGATE COMPANHIA",
          cor: "verde",
          resumo: `${brl(args.valor)} sacados por ${curto(args.companhia)}`,
          detalhes: [`saldo restante ${brl(args.saldoRestante)}`]
        };

      default:
        return null;
    }
  }
}

/** Dados de rastreio da transação, anexados à linha secundária do log. */
export function rastreio({ txHash, blockNumber, gasUsed }) {
  return [
    txHash ? `tx ${curto(txHash)}` : null,
    blockNumber != null ? `bloco ${blockNumber}` : null,
    gasUsed != null ? `gas ${numero(gasUsed)}` : null
  ].filter(Boolean);
}
