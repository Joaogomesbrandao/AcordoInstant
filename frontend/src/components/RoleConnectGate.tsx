import { useState, type FormEvent } from 'react';
import type { Role } from '../types/role';
import { isValidAddress } from '../utils/address';
import './RoleConnectGate.css';

interface RoleConnectGateProps {
  role: Role;
  connecting: boolean;
  error: string;
  onSubmit: (address: string) => void;
  onConnectMetaMask: () => void;
}

const COPY: Record<Role, { eyebrow: string; title: string; description: string; placeholder: string; accent: string }> = {
  airline: {
    eyebrow: 'Companhia aérea',
    title: 'Informe o endereço da companhia',
    description: 'Para gerenciar o fundo de garantia e cadastrar voos, informe o endereço que representa a companhia aérea.',
    placeholder: '0x2222222222222222222222222222222222222222',
    accent: 'var(--color-navy)',
  },
  passenger: {
    eyebrow: 'Passageiro',
    title: 'Informe o endereço do passageiro',
    description: 'Para se inscrever em voos e solicitar indenização, informe o endereço que representa o passageiro.',
    placeholder: '0x3333333333333333333333333333333333333333',
    accent: 'var(--color-teal-dark)',
  },
};

const hasMetaMask = typeof window !== 'undefined' && Boolean(window.ethereum);

export function RoleConnectGate({ role, connecting, error, onSubmit, onConnectMetaMask }: RoleConnectGateProps) {
  const copy = COPY[role];
  const [draft, setDraft] = useState('');
  const touched = draft.trim().length > 0;
  const valid = isValidAddress(draft);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (valid) onSubmit(draft.trim());
  }

  return (
    <section className="role-gate">
      <div className="role-gate-card">
        <span className="page-eyebrow" style={{ color: copy.accent }}>
          {copy.eyebrow}
        </span>
        <h1 className="role-gate-title">{copy.title}</h1>
        <p className="role-gate-text">{copy.description}</p>

        <form className="role-gate-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={copy.placeholder}
            className={touched && !valid ? 'invalid' : ''}
          />
          {touched && !valid && (
            <p className="role-gate-error">Esse não parece ser um endereço Ethereum válido.</p>
          )}
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Continuar
          </button>
        </form>

        {hasMetaMask && (
          <button type="button" className="role-gate-secondary" onClick={onConnectMetaMask} disabled={connecting}>
            {connecting ? 'Conectando...' : 'ou preencher com a MetaMask automaticamente'}
          </button>
        )}
        {error && <p className="role-gate-error">{error}</p>}
      </div>
    </section>
  );
}
