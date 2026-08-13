import type { Perfil } from '../tipos';
import './BarraTopo.css';

const ROTULOS: Record<Perfil, string> = {
  cliente: 'Passageiro',
  companhia: 'Companhia aérea',
  tribunal: 'TJPB · nó validador',
};

export function BarraTopo({
  perfil,
  identidade,
  aoTrocarPerfil,
  aoSair,
}: {
  perfil: Perfil;
  identidade?: string | null;
  aoTrocarPerfil: () => void;
  aoSair?: () => void;
}) {
  return (
    <header className="barra-topo">
      <div className="barra-topo-inner">
        <div className="barra-topo-marca">
          <span className="barra-topo-nome">AcordoInstant</span>
          <span className={`barra-topo-perfil perfil-${perfil}`}>{ROTULOS[perfil]}</span>
        </div>

        <div className="barra-topo-acoes">
          {identidade ? <span className="barra-topo-identidade">{identidade}</span> : null}
          {aoSair ? (
            <button type="button" className="btn btn-sm btn-outline" onClick={aoSair}>
              Sair da conta
            </button>
          ) : null}
          <button type="button" className="btn btn-sm btn-secondary" onClick={aoTrocarPerfil}>
            Trocar perfil
          </button>
        </div>
      </div>
    </header>
  );
}
