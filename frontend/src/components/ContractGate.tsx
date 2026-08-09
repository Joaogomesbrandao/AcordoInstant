import { useState, type FormEvent } from 'react';
import { isValidAddress } from '../utils/address';
import './ContractGate.css';

interface ContractGateProps {
  value: string;
  onSubmit: (value: string) => void;
}

export function ContractGate({ value, onSubmit }: ContractGateProps) {
  const [draft, setDraft] = useState(value);
  const touched = draft.trim().length > 0;
  const valid = isValidAddress(draft);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (valid) onSubmit(draft.trim());
  }

  return (
    <section className="contract-gate">
      <div className="contract-gate-card">
        <div className="contract-gate-icon" aria-hidden="true">
          🔗
        </div>
        <h1 className="contract-gate-title">Conecte-se a um contrato</h1>
        <p className="contract-gate-text">
          Informe o endereço do <code>SeguroParametrico</code> implantado para
          liberar o painel.
        </p>

        <form className="contract-gate-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="0x1111111111111111111111111111111111111111"
            className={touched && !valid ? 'invalid' : ''}
          />
          {touched && !valid && (
            <p className="contract-gate-error">Esse não parece ser um endereço Ethereum válido.</p>
          )}
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Continuar
          </button>
        </form>
      </div>
    </section>
  );
}
