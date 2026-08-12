import type {
  CadastroResultado,
  Cliente,
  EmbarqueResultado,
  PainelCliente,
  PainelCompanhia,
  PainelTribunal,
  PassageiroPendente,
  VooDisponivel,
} from './tipos';

/**
 * Cliente da API.
 *
 * O frontend não fala com a blockchain: quem assina e quem lê a cadeia é
 * sempre o backend, com a carteira do papel correspondente. Aqui só trafega
 * JSON já formatado para exibição.
 *
 * Em desenvolvimento o Vite encaminha /api e /health para a porta 3001
 * (ver vite.config.ts), então o caminho relativo basta.
 */
const BASE = import.meta.env.VITE_API_URL || '';

export class ErroApi extends Error {
  status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.status = status;
  }
}

async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers ?? {}) },
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new ErroApi(dados.erro ?? 'Falha ao comunicar com o servidor.', resposta.status);
  }

  return dados as T;
}

const postar = <T>(caminho: string, corpo?: unknown) =>
  requisitar<T>(caminho, { method: 'POST', body: JSON.stringify(corpo ?? {}) });

// --- Cliente ---------------------------------------------------------------

export const cadastrarCliente = (dados: { nome: string; cpf: string; carteira: string }) =>
  postar<CadastroResultado>('/api/cliente/cadastro', dados);

export const entrarCliente = (cpf: string) => postar<Cliente>('/api/cliente/entrar', { cpf });

export const painelDoCliente = (cpf: string) =>
  requisitar<PainelCliente>(`/api/cliente/${cpf}/painel`);

// --- Companhia aérea -------------------------------------------------------

export const painelDaCompanhia = () => requisitar<PainelCompanhia>('/api/companhia/painel');

export const voosDisponiveis = () => requisitar<VooDisponivel[]>('/api/companhia/voos-disponiveis');

export const cadastrarVoo = (codigo: string) =>
  postar<{ codigo: string; txHash: string }>('/api/companhia/voos', { codigo });

/** Embarca a lista inteira de passageiros de um voo em uma única chamada. */
export const embarcarPassageiros = (dados: {
  codigo: string;
  passageiros: PassageiroPendente[];
}) => postar<EmbarqueResultado>('/api/companhia/passageiros', dados);

export const resgatarGarantias = () =>
  postar<{ valor: string; txHash: string }>('/api/companhia/resgatar');

// --- TJPB ------------------------------------------------------------------

export const painelDoTribunal = () => requisitar<PainelTribunal>('/api/tribunal/painel');

// --- Oráculo ---------------------------------------------------------------

/** Dispara uma apuração imediata, para não depender do intervalo na demo. */
export const apurarAgora = () =>
  postar<{ apurados: { codigo: string; atrasoMinutos: number; atrasado: boolean }[] }>(
    '/api/oraculo/apurar',
  );
