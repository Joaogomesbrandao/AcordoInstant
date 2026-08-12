/**
 * Formatação compartilhada por deploy, oráculo, backend e logs.
 *
 * A rede local opera em ETH, mas a regra do contrato é escrita em reais.
 * A conversão usa uma taxa fixa de demonstração — não há câmbio real neste
 * protótipo, o objetivo é só exibir "R$ 500,00" onde o contrato guarda
 * 0,5 ETH.
 */

/** Taxa fixa de demonstração desta rede local. */
export const REAIS_POR_ETH = 1000;

const WEI_POR_ETH = 10n ** 18n;
const CENTAVOS_POR_ETH = BigInt(REAIS_POR_ETH * 100);

/** Converte wei para centavos de real usando a taxa fixa do protótipo. */
export function weiParaCentavos(wei) {
  return (BigInt(wei) * CENTAVOS_POR_ETH) / WEI_POR_ETH;
}

/** Converte centavos de real para wei usando a taxa fixa do protótipo. */
export function centavosParaWei(centavos) {
  return (BigInt(centavos) * WEI_POR_ETH) / CENTAVOS_POR_ETH;
}

/** `500000000000000000n` -> `"R$ 500,00"`. */
export function brl(wei) {
  const centavos = weiParaCentavos(wei);
  const negativo = centavos < 0n;
  const absoluto = negativo ? -centavos : centavos;

  const inteiros = (absoluto / 100n).toString();
  const decimais = (absoluto % 100n).toString().padStart(2, "0");
  const comMilhar = inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negativo ? "-" : ""}R$ ${comMilhar},${decimais}`;
}

/** `500000000000000000n` -> `"0,5 ETH"`. */
export function eth(wei) {
  const valor = Number(BigInt(wei)) / Number(WEI_POR_ETH);
  const texto = valor.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  return `${texto} ETH`;
}

/** `"0x17f9c0...a3eb"` -> `"0x17f9…a3eb"`. */
export function curto(valor, inicio = 6, fim = 4) {
  const texto = String(valor ?? "");
  if (texto.length <= inicio + fim + 1) return texto;
  return `${texto.slice(0, inicio)}…${texto.slice(-fim)}`;
}

/** Timestamp Unix -> `"03/08 12:20"` (horário de Brasília). */
export function dataHora(timestamp) {
  const numero = Number(timestamp);
  if (!numero) return "—";

  // `toLocaleString` separa data e hora com vírgula ("03/08, 09:30"); no log
  // o espaço lê melhor e ocupa menos.
  return new Date(numero * 1000)
    .toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
    .replace(",", "");
}

/** Timestamp Unix -> `"03/08/2026 12:20:31"`, para relatórios e auditoria. */
export function dataHoraCompleta(timestamp) {
  const numero = Number(timestamp);
  if (!numero) return "—";

  return new Date(numero * 1000).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "medium"
  });
}

/** `285` -> `"4h45"`; `45` -> `"45min"`; `0` -> `"no horario"`. */
export function duracao(minutos) {
  const total = Number(minutos ?? 0);
  if (total <= 0) return "no horario";

  const horas = Math.floor(total / 60);
  const resto = total % 60;

  if (horas === 0) return `${resto}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h${String(resto).padStart(2, "0")}`;
}

/** `121430` -> `"121.430"`. */
export function numero(valor) {
  return Number(valor ?? 0).toLocaleString("pt-BR");
}
