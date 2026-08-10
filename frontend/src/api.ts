import { API_URL } from './config';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    // O backend hoje mistura { erro } (rotas novas) e { error } (rotas
    // antigas), tratamos os dois para não perder a mensagem em nenhum caso.
    const message =
      payload.erro ?? payload.error ?? 'Erro inesperado ao comunicar com o backend.';
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export interface Passageiro {
  id: number;
  name: string;
  walletAddress: string;
}

export async function listarPassageiros(): Promise<Passageiro[]> {
  return request<Passageiro[]>('/api/passengers');
}

/**
 * Cadastra o passageiro pelo nome + endereço da carteira. Se o endereço já
 * estiver cadastrado, reaproveita o registro existente em vez de falhar,
 * assim o botão "Trocar usuário" funciona tanto para gente nova quanto para
 * quem já usou o sistema antes.
 */
export async function registrarPassageiro(name: string, walletAddress: string): Promise<Passageiro> {
  try {
    return await request<Passageiro>('/api/passengers', {
      method: 'POST',
      body: JSON.stringify({ name, walletAddress }),
    });
  } catch (error) {
    if (error instanceof ApiError && /ja existe/i.test(error.message)) {
      const passageiros = await listarPassageiros();
      const existente = passageiros.find(
        (passageiro) => passageiro.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
      if (existente) return existente;
    }
    throw error;
  }
}

export interface AtrasoOficial {
  vooId: string;
  atrasoHorasOficial: number;
}

export async function consultarAtrasoOficial(vooId: string, passageiro: string): Promise<AtrasoOficial> {
  return request<AtrasoOficial>(`/voos/${vooId}/consultar`, {
    method: 'POST',
    body: JSON.stringify({ passageiro }),
  });
}

export interface VooResumo {
  id: string;
  horarioPartida: number;
  horarioChegada: number;
  totalPassageiros: string;
}

// --- Ações da companhia e do passageiro que alteram o contrato ---
//
// A companhia não tem carteira conectada no frontend (a chave fica só no
// backend, que assina tudo com OPERATOR_PRIVATE_KEY) e o passageiro também
// não assina nada (só informa o endereço que recebe o depósito). Se o
// backend não tiver RPC_URL/CONTRACT_ADDRESS/OPERATOR_PRIVATE_KEY
// configurados, essas chamadas retornam erro 503 com uma mensagem clara em
// vez de "Rota nao encontrada".
export async function companhiaConsultarSaldo(): Promise<{ saldoEth: string }> {
  return request('/companhia/saldo');
}

export async function companhiaListarVoos(): Promise<VooResumo[]> {
  return request('/companhia/voos');
}

export async function companhiaDepositarFundo(valorEth: string): Promise<{ txHash: string }> {
  return request('/companhia/depositar-fundo', {
    method: 'POST',
    body: JSON.stringify({ valorEth }),
  });
}

export async function companhiaResgatarFundo(valorEth: string): Promise<{ txHash: string }> {
  return request('/companhia/resgatar-fundo', {
    method: 'POST',
    body: JSON.stringify({ valorEth }),
  });
}

export async function companhiaCadastrarVoo(
  vooId: string,
  horarioPartida: number,
  horarioChegada: number
): Promise<{ txHash: string }> {
  return request('/companhia/voos', {
    method: 'POST',
    body: JSON.stringify({ vooId, horarioPartida, horarioChegada }),
  });
}

/**
 * A companhia inscreve um passageiro já cadastrado (escolhido pelo nome na
 * interface) em um voo dela, informando o id do passageiro; o backend
 * resolve o endereço da carteira dele e assina a transação.
 */
export async function companhiaInscreverPassageiro(
  vooId: string,
  passengerId: number
): Promise<{ txHash: string }> {
  return request(`/companhia/voos/${vooId}/inscrever`, {
    method: 'POST',
    body: JSON.stringify({ passengerId }),
  });
}

export interface RegistrarAtrasoResultado {
  txHash: string;
  pago: boolean;
  mensagem: string;
}

export async function registrarAtraso(
  vooId: string,
  passageiroEndereco: string,
  atrasoHorasInformado: number,
  atrasoHorasOficial: number
): Promise<RegistrarAtrasoResultado> {
  return request(`/voos/${vooId}/registrar-atraso`, {
    method: 'POST',
    body: JSON.stringify({ passageiroEndereco, atrasoHorasInformado, atrasoHorasOficial }),
  });
}
