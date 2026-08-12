/** Formatos devolvidos pela API do backend. */

export type Perfil = 'cliente' | 'companhia' | 'tribunal';

export interface Regra {
  limiarHoras: number;
  valorWei: string;
  valor: string;
  valorCentavos: number;
  texto: string;
}

export interface Bilhete {
  id: string;
  idCurto: string;
  hashCpf: string;
  hashCpfCurto: string;
  /** Vem do manifesto off-chain da companhia — a cadeia não guarda nome. */
  passageiro: string | null;
  garantiaWei: string;
  garantia: string;
  status: 'Ativo' | 'Indenizado' | 'GarantiaLiberada' | 'Desconhecido';
  indenizado: boolean;
  garantiaDevolvida: boolean;
  quitadoEm: number | null;
}

export interface Voo {
  id: string;
  codigo: string;
  companhia: string;
  partidaPrevista: number;
  chegadaPrevista: number;
  chegadaReal: number | null;
  atrasoMinutos: number;
  atraso: string;
  status: 'Agendado' | 'Pontual' | 'Atrasado' | 'Desconhecido';
  statusRotulo: string;
  apurado: boolean;
  atrasado: boolean;
  totalBilhetes: number;
  origem: string | null;
  destino: string | null;
  operadora: string | null;
  bilhetes?: Bilhete[];
  resumo?: { emEscrow: number; indenizados: number; garantiasDevolvidas: number };
}

export interface VooDisponivel {
  codigo: string;
  operadora: string;
  origem: string;
  destino: string;
  partidaPrevista: number;
  chegadaPrevista: number;
  cadastrado: boolean;
}

export interface Cliente {
  nome: string;
  cpf: string;
  cpfDigitos: string;
  carteira: string;
  hashCpf: string;
  criadoEm: string;
}

export interface Viagem {
  bilheteId: string;
  voo: Voo;
  situacao: string;
  indenizado: boolean;
  valorRecebido: string;
  valorRecebidoWei: string;
  quitadoEm: number | null;
}

export interface PainelCliente {
  cliente: Cliente;
  regra: Regra;
  totais: {
    depositado: string;
    depositadoWei: string;
    aguardandoCadastro: string;
    viagens: number;
    indenizadas: number;
    saldoDaCarteira: string;
  };
  viagens: Viagem[];
}

export interface PainelCompanhia {
  regra: Regra;
  carteira: string;
  contrato: string;
  totais: {
    voos: number;
    aguardandoOraculo: number;
    pontuais: number;
    atrasados: number;
    passageiros: number;
    indenizacoesPagas: number;
    totalIndenizado: string;
    emEscrow: string;
    saldoLiberado: string;
    saldoLiberadoWei: string;
  };
  voos: Voo[];
}

export interface Quitacao {
  bilheteId: string;
  bilheteCurto: string;
  voo: string;
  hashCpf: string;
  hashCpfCurto: string;
  valor: string;
  atrasoMinutos: number;
  emitidoEm: number;
  txHash: string;
  txCurto: string;
  bloco: number;
}

export interface PainelTribunal {
  regra: Regra;
  identidade: { contrato: string; no: string; permissoes: string };
  totais: {
    voos: number;
    aguardandoOraculo: number;
    pontuais: number;
    atrasados: number;
    bilhetes: number;
    indenizacoes: number;
    totalIndenizado: string;
    garantiasAtivas: number;
    emEscrow: string;
    saldoCustodiado: string;
  };
  voos: Voo[];
  quitacoes: Quitacao[];
  observacao: string;
}

export interface CadastroResultado {
  cliente: Cliente;
  liberadoNoCadastro: string;
  liberadoNoCadastroWei: string;
  txHash: string;
  bloco: number;
}
