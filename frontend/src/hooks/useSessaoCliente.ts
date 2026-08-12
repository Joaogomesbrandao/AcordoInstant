import { useCallback, useState } from 'react';
import type { Cliente } from '../tipos';

const CHAVE = 'acordoinstant.cliente';

/**
 * Sessão do cliente.
 *
 * Guarda só o que identifica quem está logado; nenhum dado sensível fica no
 * navegador além do próprio CPF que a pessoa digitou, e o painel é sempre
 * relido do servidor.
 */
export function useSessaoCliente() {
  const [cliente, setCliente] = useState<Cliente | null>(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      return salvo ? (JSON.parse(salvo) as Cliente) : null;
    } catch {
      return null;
    }
  });

  const entrar = useCallback((novo: Cliente) => {
    localStorage.setItem(CHAVE, JSON.stringify(novo));
    setCliente(novo);
  }, []);

  const sair = useCallback(() => {
    localStorage.removeItem(CHAVE);
    setCliente(null);
  }, []);

  return { cliente, entrar, sair };
}
