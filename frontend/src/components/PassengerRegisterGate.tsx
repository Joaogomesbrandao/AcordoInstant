import { useState, type FormEvent } from 'react';
import { isValidAddress } from '../utils/address';
import './PassengerRegisterGate.css';

interface PassengerRegisterGateProps {
  registering: boolean;
  error: string;
  onSubmit: (name: string, address: string) => void;
}

/**
 * O passageiro só informa nome e endereço da carteira (usado exclusivamente
 * para receber o depósito da indenização) e isso já cadastra (ou reaproveita,
 * se o endereço já existir) o passageiro no backend.
 */
export function PassengerRegisterGate({ registering, error, onSubmit }: PassengerRegisterGateProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const nameTouched = name.trim().length > 0;
  const addressTouched = address.trim().length > 0;
  const addressValid = isValidAddress(address);
  const canSubmit = nameTouched && addressValid && !registering;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(name.trim(), address.trim());
  }

  return (
    <section className="passenger-gate">
      <div className="passenger-gate-card">
        <span className="page-eyebrow" style={{ color: 'var(--color-teal-dark)' }}>
          Passageiro
        </span>
        <h1 className="passenger-gate-title">Quem é você?</h1>
        <p className="passenger-gate-text">
          Informe seu nome e o endereço da sua carteira na blockchain. Ele será usado
          apenas para receber o depósito da indenização, caso seu voo tenha direito.
        </p>

        <form className="passenger-gate-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />

          <input
            type="text"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Endereço da Carteira Blockchain"
            className={addressTouched && !addressValid ? 'invalid' : ''}
          />
          {addressTouched && !addressValid && (
            <p className="passenger-gate-error">Esse não parece ser um endereço Ethereum válido.</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {registering ? 'Cadastrando...' : 'Continuar'}
          </button>
        </form>

        {error && <p className="passenger-gate-error">{error}</p>}

        <p className="passenger-gate-hint">
          O endereço pode ser só digitado ou copiado de qualquer carteira que você já tenha.
        </p>
      </div>
    </section>
  );
}
