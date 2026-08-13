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
  /** Vem do manifesto off-chain da companhia; a cadeia não guarda nome. */
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
  atrasoMinutos: number;
  atraso: string;
  /** true quando o atraso passa do limite e o voo vai indenizar. */
  indeniza: boolean;
}

/** Passageiro da lista montada antes de confirmar o embarque. */
export interface PassageiroPendente {
  nome: string;
  cpf: string;
}

export interface EmbarqueResultado {
  codigo: string;
  total: number;
  garantiaPorBilhete: string;
  garantiaTotal: string;
  embarcados: { bilheteId: string; passageiro: string; cpf: string; txHash: string }[];
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
    /** Apurado antes de o CPF ter carteira vinculada; sacável uma única vez. */
    pendente: string;
    pendenteWei: string;
    temPendencia: boolean;
    viagens: number;
    indenizadas: number;
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
    saldoCarteira: string;
    saldoCarteiraReais: string;
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
  };
  voos: Voo[];
  quitacoes: Quitacao[];
  observacao: string;
}

export interface CadastroResultado {
  cliente: Cliente;
  /** Valor que já estava reservado para o CPF e ficou disponível para saque. */
  pendente: string;
  pendenteWei?: string;
  txHash: string | null;
  bloco: number | null;
}
