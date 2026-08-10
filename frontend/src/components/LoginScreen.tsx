import heroImage from '../assets/login-hero.jpg';
import type { Role } from '../types/role';
import './LoginScreen.css';

interface LoginScreenProps {
  onEnter: (role: Role) => void;
}

const ROLES: {
  id: Role;
  title: string;
}[] = [
  {
    id: 'airline',
    title: 'Sou uma companhia aérea',
  },
  {
    id: 'passenger',
    title: 'Sou passageiro',
  },
];

export function LoginScreen({ onEnter }: LoginScreenProps) {
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
                className={`login-role login-role-${role.id}`}
                onClick={() => onEnter(role.id)}
              >
                <span className="login-role-title">{role.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="login-visual">
          <img src={heroImage} alt="Ilustração de um avião protegido por um escudo, representando o seguro de voo" />
        </div>
      </div>
    </div>
  );
}
