import { Contract, JsonRpcProvider } from 'ethers';
import { CONTRACT_ABI } from './contract';

/**
 * Configuração fixa do sistema: nada aqui aparece em nenhuma tela para o
 * usuário editar. A companhia aérea é única e suas chaves (pública/privada)
 * ficam só no backend; o frontend só precisa saber onde falar com o backend
 * e, para leituras diretas do contrato (que não exigem assinatura), o RPC e
 * o endereço do contrato já implantado.
 *
 * Em desenvolvimento (`npm run dev`) o Vite já redireciona /api, /voos,
 * /companhia e /health para o backend (ver vite.config.ts), então o padrão
 * aqui é usar caminhos relativos. Só defina VITE_API_URL se o backend
 * estiver em outro endereço (por exemplo, servido separado em produção).
 */
export const API_URL = import.meta.env.VITE_API_URL || '';
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

let cachedProvider: JsonRpcProvider | null = null;

function getProvider(): JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new JsonRpcProvider(RPC_URL);
  }
  return cachedProvider;
}

/**
 * Contrato somente-leitura: usado para consultas (consultarVoo,
 * consultarInscricao, listarVoosDoPassageiro, calcularMulta...) que não
 * exigem nenhuma carteira conectada, só um provedor RPC. Ações que alteram
 * estado (depositar, cadastrar voo, inscrever-se, registrar atraso) são
 * assinadas pelo backend, ver src/api.ts.
 */
export function getReadContract(): Contract {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      'Endereco do contrato nao configurado. Defina VITE_CONTRACT_ADDRESS no .env do frontend.'
    );
  }

  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, getProvider());
}
