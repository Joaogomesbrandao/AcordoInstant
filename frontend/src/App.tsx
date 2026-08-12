import { useState } from 'react';
import { TelaLogin } from './components/TelaLogin';
import { BarraTopo } from './components/BarraTopo';
import { AcessoCliente } from './components/AcessoCliente';
import { PainelCliente } from './components/PainelCliente';
import { PainelCompanhia } from './components/PainelCompanhia';
import { PainelTribunal } from './components/PainelTribunal';
import { useSessaoCliente } from './hooks/useSessaoCliente';
import type { Perfil } from './tipos';
import './App.css';

/**
 * Três perfis, três painéis.
 *
 * Companhia e TJPB entram direto — são instituições, e suas carteiras já
 * existem desde a implantação da rede. Só o passageiro tem cadastro e
 * login, porque é o CPF dele que identifica o dinheiro guardado no
 * contrato.
 */
export default function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const sessao = useSessaoCliente();

  if (!perfil) {
    return <TelaLogin aoEntrar={setPerfil} />;
  }

  const identidade =
    perfil === 'cliente' && sessao.cliente
      ? `${sessao.cliente.nome} · ${sessao.cliente.cpf}`
      : null;

  return (
    <div className="app">
      <BarraTopo
        perfil={perfil}
        identidade={identidade}
        aoTrocarPerfil={() => setPerfil(null)}
        aoSair={perfil === 'cliente' && sessao.cliente ? sessao.sair : undefined}
      />

      <main className="app-main">
        {perfil === 'companhia' ? <PainelCompanhia /> : null}
        {perfil === 'tribunal' ? <PainelTribunal /> : null}
        {perfil === 'cliente' ? (
          sessao.cliente ? (
            <PainelCliente cliente={sessao.cliente} />
          ) : (
            <AcessoCliente aoEntrar={sessao.entrar} />
          )
        ) : null}
      </main>
    </div>
  );
}
