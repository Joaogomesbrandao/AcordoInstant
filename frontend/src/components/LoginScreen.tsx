import { useState } from 'react';
import heroImage from '../assets/login-hero.jpg';
import type { Role } from '../types/role';
import type { WalletApi } from '../hooks/useWallet';
import { isValidAddress } from '../utils/address';
import './LoginScreen.css';

interface LoginScreenProps {
  contractAddress: string;
  onContractChange: (value: string) => void;
  wallets: Record<Role, WalletApi>;
  onEnter: (role: Role) => void;
}

const ROLES: {
  id: Role;
  title: string;
  description: string;
}[] = [
  {
    id: 'airline',
    title: 'Sou uma companhia aérea',
    description:
      'Deposite o fundo de garantia e cadastre os horários dos seus voos.',
  },
  {
    id: 'passenger',
    title: 'Sou passageiro',
    description:
      'Inscreva-se nos seus voos e receba indenização automática em caso de atraso.',
  },
];

const hasMetaMask = typeof window !== 'undefined' && Boolean(window.ethereum);

export function LoginScreen({ contractAddress, onContractChange, wallets, onEnter }: LoginScreenProps) {
  const [selected, setSelected] = useState<Role | null>(null);
  const [draftContract, setDraftContract] = useState(contractAddress);

  const contractTouched = draftContract.trim().length > 0;
  const contractValid = isValidAddress(draftContract);
  const wallet = selected ? wallets[selected] : null;
  const walletTouched = Boolean(wallet && wallet.address.trim().length > 0);
  const walletValid = Boolean(wallet && isValidAddress(wallet.address));
  const canEnter = Boolean(selected && contractValid && walletValid);

  function handleEnter() {
    if (!selected || !canEnter) return;
    onContractChange(draftContract.trim());
    onEnter(selected);
  }

  return (
    <div className="login">
      <div className="login-blob login-blob-a" aria-hidden="true" />
      <div className="login-blob login-blob-b" aria-hidden="true" />

      <div className="login-shell">
        <div className="login-copy">
          <span className="login-wordmark">AcordoInstant</span>
          <h1 className="login-headline">
            Indenização por atraso de voo, resolvida direto na blockchain.
          </h1>
          <p className="login-sub">
            Sem burocracia, sem intermediário decidindo por você: a companhia
            garante o fundo, o passageiro confirma o atraso oficial e o
            contrato paga sozinho, na hora.
          </p>

          <div className="login-roles">
            {ROLES.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`login-role login-role-${role.id} ${selected === role.id ? 'selected' : ''}`}
                onClick={() => setSelected(role.id)}
              >
                <span className="login-role-title">{role.title}</span>
                <span className="login-role-desc">{role.description}</span>
              </button>
            ))}
          </div>

          {selected && wallet && (
            <div className="login-action">
              <div className="field">
                <label htmlFor="login-contract">Endereço do contrato</label>
                <input
                  id="login-contract"
                  type="text"
                  value={draftContract}
                  onChange={(e) => setDraftContract(e.target.value)}
                  placeholder="0x1111111111111111111111111111111111111111"
                  className={contractTouched && !contractValid ? 'invalid' : ''}
                />
                {contractTouched && !contractValid && (
                  <p className="login-error">Esse não parece ser um endereço Ethereum válido.</p>
                )}
              </div>

              <div className="field">
                <label htmlFor="login-wallet">
                  Endereço da carteira ({selected === 'airline' ? 'companhia' : 'passageiro'})
                </label>
                <input
                  id="login-wallet"
                  type="text"
                  value={wallet.address}
                  onChange={(e) => wallet.setAddress(e.target.value)}
                  placeholder="0x2222222222222222222222222222222222222222"
                  className={walletTouched && !walletValid ? 'invalid' : ''}
                />
                {walletTouched && !walletValid && (
                  <p className="login-error">Esse não parece ser um endereço Ethereum válido.</p>
                )}
              </div>

              {hasMetaMask && (
                <button
                  type="button"
                  className="login-secondary-action"
                  onClick={() => wallet.connectMetaMask()}
                  disabled={wallet.connecting}
                >
                  {wallet.connecting ? 'Conectando...' : 'ou preencher com a MetaMask automaticamente'}
                </button>
              )}
              {wallet.error && <p className="login-error">{wallet.error}</p>}

              <button
                type="button"
                className="btn btn-primary login-connect-btn"
                onClick={handleEnter}
                disabled={!canEnter}
              >
                Entrar como {selected === 'airline' ? 'companhia' : 'passageiro'}
              </button>

              <p className="login-hint">
                Não é preciso ter a MetaMask instalada: qualquer endereço
                válido serve para navegar pela interface. Depois de entrar,
                você pode alternar entre Companhia e Passageiro — cada papel
                usa o seu próprio endereço.
              </p>
            </div>
          )}
        </div>

        <div className="login-visual">
          <img src={heroImage} alt="Ilustração de um avião protegido por um escudo, representando o seguro de voo" />
        </div>
      </div>
    </div>
  );
}
