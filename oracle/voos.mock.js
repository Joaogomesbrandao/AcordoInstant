/**
 * Base de voos do oráculo: o "FlightStats/ANAC" deste protótipo.
 *
 * É a fonte de dados externa e neutra prevista na proposta: fica fora da
 * blockchain e é a única origem do horário real de chegada. Nem a companhia
 * nem o passageiro conseguem alterar estes números pelo sistema.
 *
 * Como o horário real já está aqui, a apuração é automática: o serviço do
 * oráculo (oracle/oraculo.js) varre os voos cadastrados no contrato, procura
 * o código nesta base e escreve a chegada real on-chain, o que dispara a
 * execução do contrato.
 *
 * A composição dos 20 voos é proposital, para exercitar os três desfechos:
 *   - 8 voos com atraso acima de 4 h  -> indenizam o passageiro;
 *   - 3 voos atrasados abaixo de 4 h  -> não indenizam (a regra é > 4 h);
 *   - 9 voos pontuais ou adiantados   -> garantia volta para a companhia.
 *
 * Os casos de borda são deliberados: LA3890 atrasa 4 h 05 (indeniza por 5
 * minutos) e LA4115 atrasa 3 h 45 (não indeniza por 15 minutos).
 */

/** @typedef {{codigo: string, companhia: string, origem: string, destino: string, partidaPrevista: string, chegadaPrevista: string, chegadaReal: string}} VooMock */

/** @type {VooMock[]} */
export const VOOS_MOCK = [
  {
    codigo: "AD4021",
    companhia: "Azul",
    origem: "JPA",
    destino: "GRU",
    partidaPrevista: "2026-08-03T06:10:00-03:00",
    chegadaPrevista: "2026-08-03T09:45:00-03:00",
    chegadaReal: "2026-08-03T09:40:00-03:00"
  },
  {
    codigo: "G31702",
    companhia: "Gol",
    origem: "REC",
    destino: "BSB",
    partidaPrevista: "2026-08-03T09:30:00-03:00",
    chegadaPrevista: "2026-08-03T12:20:00-03:00",
    chegadaReal: "2026-08-03T17:05:00-03:00"
  },
  {
    codigo: "LA3421",
    companhia: "Latam",
    origem: "GRU",
    destino: "JPA",
    partidaPrevista: "2026-08-03T15:05:00-03:00",
    chegadaPrevista: "2026-08-03T18:30:00-03:00",
    chegadaReal: "2026-08-03T18:35:00-03:00"
  },
  {
    codigo: "AD2588",
    companhia: "Azul",
    origem: "BSB",
    destino: "REC",
    partidaPrevista: "2026-08-04T18:40:00-03:00",
    chegadaPrevista: "2026-08-04T21:15:00-03:00",
    chegadaReal: "2026-08-04T22:40:00-03:00"
  },
  {
    codigo: "G31145",
    companhia: "Gol",
    origem: "GIG",
    destino: "SSA",
    partidaPrevista: "2026-08-04T08:20:00-03:00",
    chegadaPrevista: "2026-08-04T11:00:00-03:00",
    chegadaReal: "2026-08-04T16:20:00-03:00"
  },
  {
    codigo: "LA4702",
    companhia: "Latam",
    origem: "CGH",
    destino: "CWB",
    partidaPrevista: "2026-08-04T07:45:00-03:00",
    chegadaPrevista: "2026-08-04T08:55:00-03:00",
    chegadaReal: "2026-08-04T08:50:00-03:00"
  },
  {
    codigo: "AD5310",
    companhia: "Azul",
    origem: "FOR",
    destino: "GRU",
    partidaPrevista: "2026-08-05T11:15:00-03:00",
    chegadaPrevista: "2026-08-05T14:40:00-03:00",
    chegadaReal: "2026-08-05T20:15:00-03:00"
  },
  {
    codigo: "G32204",
    companhia: "Gol",
    origem: "POA",
    destino: "GIG",
    partidaPrevista: "2026-08-05T14:10:00-03:00",
    chegadaPrevista: "2026-08-05T16:05:00-03:00",
    chegadaReal: "2026-08-05T16:05:00-03:00"
  },
  {
    codigo: "LA3890",
    companhia: "Latam",
    origem: "SSA",
    destino: "BSB",
    partidaPrevista: "2026-08-05T08:15:00-03:00",
    chegadaPrevista: "2026-08-05T10:30:00-03:00",
    chegadaReal: "2026-08-05T14:35:00-03:00"
  },
  {
    codigo: "AD1176",
    companhia: "Azul",
    origem: "JPA",
    destino: "REC",
    partidaPrevista: "2026-08-06T06:30:00-03:00",
    chegadaPrevista: "2026-08-06T07:20:00-03:00",
    chegadaReal: "2026-08-06T07:18:00-03:00"
  },
  {
    codigo: "G31955",
    companhia: "Gol",
    origem: "MAO",
    destino: "BSB",
    partidaPrevista: "2026-08-06T09:50:00-03:00",
    chegadaPrevista: "2026-08-06T13:45:00-03:00",
    chegadaReal: "2026-08-06T19:30:00-03:00"
  },
  {
    codigo: "LA4115",
    companhia: "Latam",
    origem: "CNF",
    destino: "GRU",
    partidaPrevista: "2026-08-06T08:05:00-03:00",
    chegadaPrevista: "2026-08-06T09:10:00-03:00",
    chegadaReal: "2026-08-06T12:55:00-03:00"
  },
  {
    codigo: "AD3067",
    companhia: "Azul",
    origem: "NAT",
    destino: "GRU",
    partidaPrevista: "2026-08-07T11:40:00-03:00",
    chegadaPrevista: "2026-08-07T15:25:00-03:00",
    chegadaReal: "2026-08-07T15:30:00-03:00"
  },
  {
    codigo: "G32671",
    companhia: "Gol",
    origem: "GRU",
    destino: "SLZ",
    partidaPrevista: "2026-08-07T17:20:00-03:00",
    chegadaPrevista: "2026-08-07T20:40:00-03:00",
    chegadaReal: "2026-08-08T02:10:00-03:00"
  },
  {
    codigo: "LA3308",
    companhia: "Latam",
    origem: "VIX",
    destino: "CGH",
    partidaPrevista: "2026-08-07T10:50:00-03:00",
    chegadaPrevista: "2026-08-07T12:15:00-03:00",
    chegadaReal: "2026-08-07T12:10:00-03:00"
  },
  {
    codigo: "AD4499",
    companhia: "Azul",
    origem: "REC",
    destino: "GIG",
    partidaPrevista: "2026-08-08T14:35:00-03:00",
    chegadaPrevista: "2026-08-08T17:50:00-03:00",
    chegadaReal: "2026-08-08T22:35:00-03:00"
  },
  {
    codigo: "G31088",
    companhia: "Gol",
    origem: "BSB",
    destino: "FOR",
    partidaPrevista: "2026-08-08T16:20:00-03:00",
    chegadaPrevista: "2026-08-08T19:05:00-03:00",
    chegadaReal: "2026-08-08T21:20:00-03:00"
  },
  {
    codigo: "LA4650",
    companhia: "Latam",
    origem: "CWB",
    destino: "POA",
    partidaPrevista: "2026-08-09T09:35:00-03:00",
    chegadaPrevista: "2026-08-09T10:45:00-03:00",
    chegadaReal: "2026-08-09T10:40:00-03:00"
  },
  {
    codigo: "AD2733",
    companhia: "Azul",
    origem: "GRU",
    destino: "JPA",
    partidaPrevista: "2026-08-09T20:05:00-03:00",
    chegadaPrevista: "2026-08-09T23:30:00-03:00",
    chegadaReal: "2026-08-10T05:00:00-03:00"
  },
  {
    codigo: "G31420",
    companhia: "Gol",
    origem: "SSA",
    destino: "REC",
    partidaPrevista: "2026-08-10T07:15:00-03:00",
    chegadaPrevista: "2026-08-10T08:20:00-03:00",
    chegadaReal: "2026-08-10T08:25:00-03:00"
  }
];

/** Converte a data ISO da base para o timestamp Unix usado no contrato. */
export function paraTimestamp(iso) {
  return Math.floor(new Date(iso).getTime() / 1000);
}

/** Localiza um voo na base do oráculo pelo código (case-insensitive). */
export function buscarVoo(codigo) {
  const alvo = String(codigo ?? "").trim().toUpperCase();
  return VOOS_MOCK.find((voo) => voo.codigo === alvo) ?? null;
}

/** Atraso apurado do voo, em minutos (0 quando chegou no horário ou antes). */
export function atrasoMinutos(voo) {
  const diferenca = paraTimestamp(voo.chegadaReal) - paraTimestamp(voo.chegadaPrevista);
  return diferenca > 0 ? Math.floor(diferenca / 60) : 0;
}

/** Lista os voos já enriquecidos com o atraso apurado, para telas e relatórios. */
export function listarVoosComAtraso() {
  return VOOS_MOCK.map((voo) => ({ ...voo, atrasoMinutos: atrasoMinutos(voo) }));
}
