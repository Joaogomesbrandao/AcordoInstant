import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Log do AcordoInstant: mesma linha impressa no terminal e gravada em
 * `logs/*.log`.
 *
 * O formato foi pensado para ser lido de relance durante a demonstração:
 * cada movimentação ocupa uma linha de destaque (o que aconteceu) e, quando
 * há transação envolvida, uma linha secundária alinhada com os dados de
 * rastreio (hash, bloco, gás). Nada além disso — nenhum objeto cru, nenhum
 * campo que não ajude a entender ou auditar a ação.
 *
 *     16:42:31  CHEGADA REPORTADA    G31702 · real 03/08 17:05 · atraso 4h45
 *                                    tx 0x51de…22f4 · bloco 9 · gas 187.902
 *
 * No arquivo a mesma entrada leva a data completa e perde as cores, para
 * continuar legível em `cat`, `grep` e `tail -f`.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_LOGS = path.join(RAIZ, "logs");

// Cabe o maior rótulo em uso ("FRONTEND CONFIGURADO") com folga para o
// espaço que separa o rótulo do resumo.
const LARGURA_ROTULO = 22;
const RECUO = " ".repeat(10 + LARGURA_ROTULO);

const CORES = {
  cinza: "[90m",
  vermelho: "[31m",
  verde: "[32m",
  amarelo: "[33m",
  azul: "[34m",
  magenta: "[35m",
  ciano: "[36m",
  branco: "[37m",
  negrito: "[1m",
  reset: "[0m"
};

const usarCor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

function pintar(texto, cor) {
  if (!usarCor || !cor || !CORES[cor]) return texto;
  return `${CORES[cor]}${texto}${CORES.reset}`;
}

function horaCurta(data) {
  return data.toLocaleTimeString("pt-BR", { hour12: false });
}

function dataCompleta(data) {
  const iso = new Date(data.getTime() - data.getTimezoneOffset() * 60_000).toISOString();
  return iso.slice(0, 19).replace("T", " ");
}

/**
 * Cria um log com destino em `logs/<arquivo>`.
 * @param {string} arquivo nome do arquivo, ex.: "blockchain.log"
 */
export function criarLogger(arquivo = "blockchain.log") {
  const destino = path.join(PASTA_LOGS, arquivo);
  let pastaPronta = false;

  function gravar(linhas) {
    try {
      if (!pastaPronta) {
        mkdirSync(PASTA_LOGS, { recursive: true });
        pastaPronta = true;
      }
      appendFileSync(destino, `${linhas.join("\n")}\n`, "utf8");
    } catch (erro) {
      // Um log que derruba a aplicação seria pior do que um log perdido.
      console.error(`[log] falha ao gravar em ${destino}: ${erro.message}`);
    }
  }

  /**
   * Registra uma movimentação.
   * @param {object} entrada
   * @param {string} entrada.rotulo  ex.: "VOO CADASTRADO"
   * @param {string} entrada.resumo  o que aconteceu, em uma linha
   * @param {string[]} [entrada.detalhes] rastreio: tx, bloco, gás, endereços
   * @param {string} [entrada.cor] cor do rótulo no terminal
   */
  function evento({ rotulo, resumo, detalhes = [], cor = "ciano" }) {
    const agora = new Date();
    const marcado = String(rotulo).padEnd(LARGURA_ROTULO);
    const complemento = detalhes.filter(Boolean).join(" · ");

    console.log(
      `${pintar(horaCurta(agora), "cinza")}  ${pintar(marcado, cor)}${resumo}`
    );
    if (complemento) {
      console.log(pintar(`${RECUO}${complemento}`, "cinza"));
    }

    const linhas = [`${dataCompleta(agora)}  ${marcado}${resumo}`];
    if (complemento) {
      linhas.push(`${" ".repeat(19 + 2 + LARGURA_ROTULO)}${complemento}`);
    }
    gravar(linhas);
  }

  /** Cabeçalho de bloco, usado no início do deploy e do backend. */
  function secao(titulo, subtitulo = "") {
    const barra = "─".repeat(Math.max(0, 62 - titulo.length));

    console.log("");
    console.log(pintar(`── ${titulo} ${barra}`, "negrito"));
    if (subtitulo) console.log(pintar(`   ${subtitulo}`, "cinza"));
    console.log("");

    const linhas = ["", `== ${titulo} ==`];
    if (subtitulo) linhas.push(`   ${subtitulo}`);
    gravar(linhas);
  }

  function simples(texto, cor = null) {
    console.log(cor ? pintar(texto, cor) : texto);
    gravar([texto]);
  }

  const info = (texto) => evento({ rotulo: "INFO", resumo: texto, cor: "azul" });
  const aviso = (texto) => evento({ rotulo: "AVISO", resumo: texto, cor: "amarelo" });
  const erro = (texto) => evento({ rotulo: "ERRO", resumo: texto, cor: "vermelho" });

  return { evento, secao, simples, info, aviso, erro, destino };
}

/** Log padrão das movimentações on-chain. */
export const log = criarLogger("blockchain.log");
