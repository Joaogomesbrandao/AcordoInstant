import { painelDoTribunal } from '../api';
import { usePainel } from '../hooks/usePainel';
import { dataHora, estadoDoVoo } from '../utils/formato';
import { Aviso, FaixaRegra, Hash, Indicadores, LinhaVoo, Vazio } from './comuns';
import './painel.css';

/**
 * Painel do TJPB: o nó validador.
 *
 * Deliberadamente não há nenhum botão de ação: o Tribunal audita a cópia do
 * registro e não interfere no processo. O que ele enxerga aqui é o mesmo que
 * qualquer nó da rede enxerga, sem dado pessoal nenhum.
 */
export function PainelTribunal() {
  const { dados, erro, carregando } = usePainel(painelDoTribunal);

  if (carregando && !dados) return <p className="carregando">Carregando o registro…</p>;
  if (erro && !dados) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  return (
    <div className="painel">
      <header className="painel-cabecalho">
        <span className="painel-etiqueta">Tribunal de Justiça da Paraíba</span>
        <h1 className="painel-titulo">Auditoria do registro</h1>
        <p className="painel-descricao">
          Cópia integral dos contratos de seguro e dos termos de quitação emitidos. O TJPB valida o
          cumprimento do contrato sem acessar os autos e sem contatar a vara.
        </p>

        <div className="identidade">
          <Hash valor={dados.identidade.no} rotulo="Nó validador" />
          <Hash valor={dados.identidade.contrato} rotulo="Contrato" />
          <span className="selo-leitura">{dados.identidade.permissoes}</span>
        </div>
      </header>

      <Indicadores
        colunas={3}
        itens={[
          { valor: dados.totais.voos, rotulo: 'Contratos de voo' },
          { valor: dados.totais.bilhetes, rotulo: 'Bilhetes segurados' },
          { valor: dados.totais.aguardandoOraculo, rotulo: 'Aguardando apuração' },
          { valor: dados.totais.atrasados, rotulo: 'Voos atrasados' },
          { valor: dados.totais.indenizacoes, rotulo: 'Indenizações executadas' },
          { valor: dados.totais.totalIndenizado, rotulo: 'Total pago aos passageiros' },
        ]}
      />

      <FaixaRegra
        regra={dados.regra}
        nota="Esta é a condição que a companhia está obrigada a cumprir, lida do contrato publicado."
      />

      <section className="bloco card">
        <div className="bloco-titulo">
          <h2>Termos de quitação</h2>
          <p>
            Prova de que o passageiro foi indenizado. É o registro a ser consultado caso a mesma
            pessoa ingresse no Juizado pelos danos materiais já quitados.
          </p>
        </div>

        {dados.quitacoes.length === 0 ? (
          <Vazio>Nenhum termo de quitação emitido até agora.</Vazio>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Voo</th>
                  <th>Passageiro (hash)</th>
                  <th>Valor</th>
                  <th>Emitido em</th>
                  <th>Transação</th>
                  <th>Bloco</th>
                </tr>
              </thead>
              <tbody>
                {dados.quitacoes.map((quitacao) => (
                  <tr key={`${quitacao.txHash}-${quitacao.bilheteId}`}>
                    <td>{quitacao.voo}</td>
                    <td>
                      <code title={quitacao.hashCpf}>{quitacao.hashCpfCurto}</code>
                    </td>
                    <td>{quitacao.valor}</td>
                    <td>{dataHora(quitacao.emitidoEm)}</td>
                    <td>
                      <code title={quitacao.txHash}>{quitacao.txCurto}</code>
                    </td>
                    <td>{quitacao.bloco}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bloco card">
        <div className="bloco-titulo">
          <h2>Registro de voos</h2>
          <p>{dados.totais.aguardandoOraculo} contratos ainda aguardando apuração do oráculo.</p>
        </div>

        {dados.voos.length === 0 ? (
          <Vazio>Nenhum contrato registrado na rede ainda.</Vazio>
        ) : (
          <ul className="lista-voos">
            {dados.voos.map((voo) => (
              <li key={voo.id} className={`voo ${estadoDoVoo(voo)}`}>
                <LinhaVoo voo={voo} />

                <div className="voo-auditoria">
                  <span>
                    {voo.totalBilhetes} bilhete(s) · {voo.resumo?.indenizados ?? 0} indenizado(s) ·{' '}
                    {voo.resumo?.garantiasDevolvidas ?? 0} garantia(s) devolvida(s)
                  </span>
                  <Hash valor={voo.companhia} rotulo="Companhia" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="nota-lgpd nota-rodape">{dados.observacao}</p>
    </div>
  );
}
