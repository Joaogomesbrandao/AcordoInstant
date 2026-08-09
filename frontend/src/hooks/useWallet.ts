import { useCallback, useEffect, useState } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

interface WalletState {
  address: string;
  signer: JsonRpcSigner | null;
  connecting: boolean;
  error: string;
}

/**
 * Identidade de um papel (companhia ou passageiro). O endereço pode ser
 * apenas digitado — não é obrigatório ter a MetaMask instalada para navegar
 * pela interface. `connectMetaMask` é só um atalho opcional: quando
 * disponível, preenche o endereço automaticamente e anexa um `signer` real,
 * necessário apenas para assinar transações de verdade.
 *
 * Cada chamada deste hook mantém seu próprio estado — usado para ter uma
 * identidade independente para a companhia e outra para o passageiro.
 */
export function useWallet() {
  const [address, setAddressState] = useState('');
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setAddressState('');
    setSigner(null);
    setError('');
  }, []);

  const setAddress = useCallback((value: string) => {
    setAddressState(value);
    // Um endereço digitado à mão não tem um signer real associado.
    setSigner(null);
    setError('');
  }, []);

  const connectMetaMask = useCallback(async (forceAccountPicker = false) => {
    if (!window.ethereum) {
      setError('MetaMask não foi encontrada neste navegador.');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      const provider = new BrowserProvider(window.ethereum);

      if (forceAccountPicker) {
        // Força a MetaMask a reabrir o seletor de contas, permitindo trocar
        // de carteira mesmo que uma conta já esteja autorizada neste site.
        await provider.send('wallet_requestPermissions', [{ eth_accounts: {} }]).catch(() => {});
      }

      await provider.send('eth_requestAccounts', []);
      const newSigner = await provider.getSigner();
      const newAddress = await newSigner.getAddress();

      setSigner(newSigner);
      setAddressState(newAddress);
    } catch (err) {
      console.error('Erro ao conectar carteira:', err);
      setError('Não foi possível conectar a carteira.');
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    function handleAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) {
        reset();
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', reset);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', reset);
    };
  }, [reset]);

  const state: WalletState = { address, signer, connecting, error };

  return { ...state, setAddress, connectMetaMask, disconnect: reset };
}

export type WalletApi = ReturnType<typeof useWallet>;
