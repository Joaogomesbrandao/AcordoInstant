import { useCallback } from 'react';
import { painelDoCliente } from '../api';
import { usePainel } from '../hooks/usePainel';
import type { Cliente } from '../tipos';
import { dataHora } from '../utils/formato';
import { Aviso, FaixaRegra, Hash, Indicadores, LinhaVoo, Vazio } from './comuns';
import './painel.css';

/**
 * Dashboard do passageiro.
 *
 * Não há botão de saque em lugar nenhum, e isso é o desenho da solução: a
 * indenização é depositada direto na carteira quando o oráculo confirma o
 * atraso. A tela serve para acompanhar os voos e conferir quanto já foi
 * pago — por voo e no total.
 */
export function PainelCliente({ cliente }: { cliente: Cliente }) {
  const carregar = useCallback(() => painelDoCliente(cliente.cpfDigitos), [cliente.cpfDigitos]);
  const { dados, erro, carregando } = usePainel(carregar);

  if (carregando && !dados) return <p className="carregando">Carregando seus voos…</p>;
  if (erro && !dados) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  return (
    <div className="painel">
      <header className="painel-cabecalho">
        <span className="painel-etiqueta">Painel do passageiro</span>
        <h1 className="painel-titulo">Olá, {dados.cliente.nome.split(' ')[0]}</h1>
        <p className="painel-descricao">
          Seus voos segurados, o desfecho de cada um e o valor já depositado na sua carteira.
        </p>

        <div className="identidade">
          <span>
            CPF <strong>{dados.cliente.cpf}</strong>
          </span>
          <Hash valor={dados.cliente.carteira} rotulo="Carteira" />
          <Hash valor={dados.cliente.hashCpf} rotulo="Identificador on-chain" />
        </div>
      </header>

      <Indicadores
        itens={[
          { valor: dados.totais.depositado, rotulo: 'Já depositado na sua carteira' },
          { valor: dados.totais.viagens, rotulo: 'Voos segurados' },
          { valor: dados.totais.indenizadas, rotulo: 'Voos indenizados' },
          { valor: dados.totais.saldoDaCarteira, rotulo: 'Saldo da carteira' },
        ]}
      />

      <FaixaRegra
        regra={dados.regra}
        nota="Você não precisa solicitar nada: o pagamento é automático e cai direto na sua carteira."
      />

      {dados.totais.aguardandoCadastro !== 'R$ 0,00' ? (
        <Aviso tipo="info">
          {dados.totais.aguardandoCadastro} estão reservados para o seu CPF e serão depositados na
          próxima atualização.
        </Aviso>
      ) : null}

      <section className="bloco card">
        <div className="bloco-titulo">
          <h2>Seus voos</h2>
          <p>Atualiza sozinho conforme o oráculo apura cada voo.</p>
        </div>

        {dados.viagens.length === 0 ? (
          <Vazio>
            Nenhum voo registrado no seu CPF ainda. Quando uma companhia embarcar você em um voo
            segurado, ele aparece aqui.
          </Vazio>
        ) : (
          <ul className="lista-voos">
            {dados.viagens.map((viagem) => (
              <li key={viagem.bilheteId} className="voo">
                <LinhaVoo
                  voo={viagem.voo}
                  extra={
                    viagem.indenizado ? (
                      <span className="valor-recebido">+{viagem.valorRecebido}</span>
                    ) : null
                  }
                />

                <footer className="voo-rodape">
                  <span className={viagem.indenizado ? 'situacao situacao-paga' : 'situacao'}>
                    {viagem.situacao}
                  </span>
                  {viagem.quitadoEm ? (
                    <span className="voo-nota">
                      Termo de quitação emitido em {dataHora(viagem.quitadoEm)}
                    </span>
                  ) : null}
                </footer>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
