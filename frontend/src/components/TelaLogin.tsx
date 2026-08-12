import type { Perfil } from '../tipos';
import heroImagem from '../assets/login-hero.jpg';
import './TelaLogin.css';

const PERFIS: { perfil: Perfil; titulo: string; descricao: string; classe: string }[] = [
  {
    perfil: 'cliente',
    titulo: 'Sou passageiro',
    descricao: 'Acompanhe seus voos e receba a indenização direto na sua carteira.',
    classe: 'perfil-cliente',
  },
  {
    perfil: 'companhia',
    titulo: 'Sou companhia aérea',
    descricao: 'Registre voos e passageiros e deposite a garantia de cada bilhete.',
    classe: 'perfil-companhia',
  },
  {
    perfil: 'tribunal',
    titulo: 'Sou o TJPB',
    descricao: 'Audite os registros, os contratos e os termos de quitação emitidos.',
    classe: 'perfil-tribunal',
  },
];

export function TelaLogin({ aoEntrar }: { aoEntrar: (perfil: Perfil) => void }) {
  return (
    <div className="login">
      <div className="login-blob login-blob-a" />
      <div className="login-blob login-blob-b" />

      <div className="login-shell">
        <div>
          <span className="login-wordmark">AcordoInstant</span>

          <h1 className="login-headline">Seguro de voo que se paga sozinho.</h1>

          <p className="login-sub">
            Se o voo atrasa mais de 4 horas, o contrato inteligente deposita a indenização na
            carteira do passageiro — sem processo, sem advogado e sem pedir nada ao Juizado. O
            Tribunal recebe a cópia do registro e o termo de quitação.
          </p>

          <div className="login-perfis">
            {PERFIS.map((item) => (
              <button
                key={item.perfil}
                type="button"
                className={`login-perfil ${item.classe}`}
                onClick={() => aoEntrar(item.perfil)}
              >
                <span className="login-perfil-titulo">{item.titulo}</span>
                <span className="login-perfil-descricao">{item.descricao}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="login-visual">
          <img src={heroImagem} alt="" />
        </div>
      </div>
    </div>
  );
}
