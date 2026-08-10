import { truncateAddress } from '../utils/address';
import type { Role } from '../types/role';
import type { PassengerIdentity } from '../hooks/usePassengerIdentity';
import './TopBar.css';

interface TopBarProps {
  activeTab: Role;
  onTabChange: (tab: Role) => void;
  passengerIdentity: PassengerIdentity | null;
  onSwitchUser: () => void;
  onLogout: () => void;
}

const TABS: { id: Role; label: string }[] = [
  { id: 'airline', label: 'Companhia' },
  { id: 'passenger', label: 'Passageiro' },
];

export function TopBar({ activeTab, onTabChange, passengerIdentity, onSwitchUser, onLogout }: TopBarProps) {
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
          {activeTab === 'airline' ? (
            <span className="identity-chip" title="A companhia é única e configurada automaticamente pelo backend.">
              <span className="identity-chip-dot" aria-hidden="true" />
              Companhia automática
            </span>
          ) : passengerIdentity ? (
            <span className="identity-chip" title={passengerIdentity.address}>
              <span className="identity-chip-dot" aria-hidden="true" />
              {passengerIdentity.name} · {truncateAddress(passengerIdentity.address)}
            </span>
          ) : (
            <span className="identity-chip identity-chip-empty">Nenhum usuário selecionado</span>
          )}

          {activeTab === 'passenger' && (
            <button type="button" className="topbar-text-btn" onClick={onSwitchUser}>
              Trocar usuário
            </button>
          )}

          <button type="button" className="btn btn-outline btn-sm" onClick={onLogout}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
