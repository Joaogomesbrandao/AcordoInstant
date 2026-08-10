import { useCallback, useEffect, useState } from 'react';
import { registrarPassageiro } from '../api';

const STORAGE_KEY = 'acordoinstant.passageiro';

export interface PassengerIdentity {
  name: string;
  address: string;
}

function readStoredIdentity(): PassengerIdentity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PassengerIdentity) : null;
  } catch {
    return null;
  }
}

/**
 * Identidade do passageiro: apenas nome + endereço da carteira (usado só
 * para receber o depósito da indenização), sem nenhuma chave privada no
 * navegador. "Trocar usuário" cadastra (ou reaproveita, se o endereço já
 * existir) esse par no backend e passa a usá-lo.
 */
export function usePassengerIdentity() {
  const [identity, setIdentityState] = useState<PassengerIdentity | null>(() => readStoredIdentity());
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (identity) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [identity]);

  const registrar = useCallback(async (name: string, address: string) => {
    setRegistering(true);
    setError('');

    try {
      const passageiro = await registrarPassageiro(name.trim(), address.trim());
      setIdentityState({ name: passageiro.name, address: passageiro.walletAddress });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar passageiro.');
      return false;
    } finally {
      setRegistering(false);
    }
  }, []);

  const limpar = useCallback(() => {
    setIdentityState(null);
    setError('');
  }, []);

  return { identity, registering, error, registrar, limpar };
}

export type PassengerIdentityApi = ReturnType<typeof usePassengerIdentity>;
