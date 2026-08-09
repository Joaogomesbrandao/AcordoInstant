import { useState } from 'react';
import { truncateAddress } from '../utils/address';
import type { Role } from '../types/role';
import './TopBar.css';

interface TopBarProps {
  activeTab: Role;
  onTabChange: (tab: Role) => void;
  contractAddress: string;
  hasValidContract: boolean;
  onContractChange: (value: string) => void;
  walletAddress: string;
  onLogout: () => void;
  onSwitchAccount: () => void;
}

const TABS: { id: Role; label: string }[] = [
  { id: 'airline', label: 'Companhia' },
  { id: 'passenger', label: 'Passageiro' },
];

export function TopBar({
  activeTab,
  onTabChange,
  contractAddress,
  hasValidContract,
  onContractChange,
  walletAddress,
  onLogout,
  onSwitchAccount,
}: TopBarProps) {
  const [editingContract, setEditingContract] = useState(false);
  const [draftAddress, setDraftAddress] = useState(contractAddress);

  function startEditing() {
    setDraftAddress(contractAddress);
    setEditingContract(true);
  }

  function saveContract() {
    onContractChange(draftAddress);
    setEditingContract(false);
  }

  function cancelEditing() {
    setEditingContract(false);
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <span className="topbar-title">AcordoInstant</span>

          <nav className="topbar-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`topbar-tab topbar-tab-${tab.id} ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-actions">
          {editingContract ? (
            <div className="contract-editor">
              <input
                autoFocus
                type="text"
                value={draftAddress}
                onChange={(e) => setDraftAddress(e.target.value)}
                placeholder="0x..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveContract();
                  if (e.key === 'Escape') cancelEditing();
                }}
              />
              <button className="topbar-icon-btn" onClick={saveContract} title="Salvar">
                ✓
              </button>
              <button className="topbar-icon-btn" onClick={cancelEditing} title="Cancelar">
                ✕
              </button>
            </div>
          ) : (
            <button
              className={`contract-chip ${hasValidContract ? '' : 'contract-chip-empty'}`}
              onClick={startEditing}
              title="Alterar endereço do contrato"
            >
              <span className="contract-chip-dot" aria-hidden="true" />
              {hasValidContract ? truncateAddress(contractAddress) : 'Definir contrato'}
            </button>
          )}

          <span className="wallet-chip" title={walletAddress}>
            {walletAddress ? truncateAddress(walletAddress) : 'Não conectada'}
          </span>

          <button type="button" className="topbar-text-btn" onClick={onSwitchAccount} disabled={!walletAddress}>
            Trocar de conta
          </button>

          <button type="button" className="btn btn-outline btn-sm" onClick={onLogout}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
