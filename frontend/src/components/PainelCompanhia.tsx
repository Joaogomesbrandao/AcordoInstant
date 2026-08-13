import { useCallback, useEffect, useState } from 'react';
import {
  ErroApi,
  embarcarPassageiros,
  painelDaCompanhia,
  resgatarGarantias,
  voosDisponiveis,
} from '../api';
import { usePainel } from '../hooks/usePainel';
import type { PassageiroPendente, VooDisponivel } from '../tipos';
import { estadoDoVoo, mascaraCpf } from '../utils/formato';
import { Aviso, FaixaRegra, Hash, Indicadores, LinhaVoo, Vazio } from './comuns';
import './painel.css';

/**
 * Dashboard da companhia aérea.
 *
 * A companhia faz duas coisas: embarca passageiros, o que trava a garantia
 * de cada bilhete no escrow, e resgata as garantias dos voos que chegaram
 * no prazo. Ela não declara atraso nem decide pagamento: isso é do oráculo
 * e do contrato.
 */
export function PainelCompanhia() {
  // Atualiza mais rápido que o padrão: a apuração acontece poucos segundos
  // depois do cadastro do voo, e a tela precisa acompanhar essa mudança que
  // ninguém pediu ali.
  const { dados, erro, carregando, atualizar } = usePainel(painelDaCompanhia, 2000);

  const [voos, setVoos] = useState<VooDisponivel[]>([]);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');

  // Lista montada na tela antes de qualquer transação sair. Os passageiros
  // só vão para a blockchain quando o embarque é confirmado.
  const [pendentes, setPendentes] = useState<PassageiroPendente[]>([]);

  const [mensagem, setMensagem] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const recarregarVoos = useCallback(() => {
    voosDisponiveis()
      .then(setVoos)
      .catch(() => setVoos([]));
  }, []);

  useEffect(recarregarVoos, [recarregarVoos]);

  const vooEscolhido = voos.find((voo) => voo.codigo === codigo) ?? null;

  function adicionar(evento: React.FormEvent) {
    evento.preventDefault();
    setFalha(null);

    const digitos = cpf.replace(/\D/g, '');

    if (pendentes.some((passageiro) => passageiro.cpf.replace(/\D/g, '') === digitos)) {
      setFalha('Este CPF já está na lista.');
      return;
    }

    setPendentes([...pendentes, { nome: nome.trim(), cpf }]);
    setNome('');
    setCpf('');
  }

  function remover(indice: number) {
    setPendentes(pendentes.filter((_, posicao) => posicao !== indice));
  }

  async function confirmar() {
    setMensagem(null);
    setFalha(null);
    setEnviando(true);

    try {
      const resultado = await embarcarPassageiros({ codigo, passageiros: pendentes });
      setMensagem(
        `${resultado.total} passageiro(s) embarcado(s) no voo ${resultado.codigo}. ` +
          `${resultado.garantiaTotal} depositados no escrow.`,
      );
      setPendentes([]);
      await atualizar();
      recarregarVoos();
    } catch (erroEnvio) {
      setFalha(erroEnvio instanceof ErroApi ? erroEnvio.message : 'Falha ao embarcar passageiros.');
    } finally {
      setEnviando(false);
    }
  }

  async function resgatar() {
    setMensagem(null);
    setFalha(null);

    try {
      const resultado = await resgatarGarantias();
      setMensagem(`${resultado.valor} resgatados para a carteira da companhia.`);
      await atualizar();
    } catch (erroResgate) {
      setFalha(erroResgate instanceof ErroApi ? erroResgate.message : 'Falha no resgate.');
    }
  }

  if (carregando && !dados) return <p className="carregando">Carregando o painel…</p>;
  if (erro && !dados) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  const temSaldo = dados.totais.saldoLiberadoWei !== '0';

  return (
    <div className="painel">
      <header className="painel-cabecalho">
        <span className="painel-etiqueta">Painel da companhia aérea</span>
        <h1 className="painel-titulo">Operação e garantias</h1>
        <p className="painel-descricao">
          Cada passageiro embarcado trava {dados.regra.valor} de garantia no contrato. Quando o
          oráculo apura o voo, o valor vira indenização ou volta para a companhia.
        </p>

        <div className="identidade">
          <Hash valor={dados.carteira} rotulo="Carteira da companhia" />
          <Hash valor={dados.contrato} rotulo="Contrato" />
        </div>
      </header>

      <Indicadores
        colunas={4}
        itens={[
          {
            valor: dados.totais.saldoCarteiraReais,
            rotulo: 'Saldo da carteira',
            nota: dados.totais.saldoCarteira,
          },
          { valor: dados.totais.emEscrow, rotulo: 'Em escrow' },
          { valor: dados.totais.saldoLiberado, rotulo: 'Liberado para resgate' },
          { valor: dados.totais.totalIndenizado, rotulo: 'Já indenizado' },
        ]}
      />

      <Indicadores
        colunas={4}
        itens={[
          { valor: dados.totais.voos, rotulo: 'Voos cadastrados' },
          { valor: dados.totais.aguardandoOraculo, rotulo: 'Aguardando apuração' },
          { valor: dados.totais.atrasados, rotulo: 'Voos atrasados' },
          { valor: dados.totais.pontuais, rotulo: 'Voos no prazo' },
        ]}
      />

      <FaixaRegra
        regra={dados.regra}
        nota="A companhia não declara o atraso: o horário real vem do oráculo, fora da blockchain."
      />

      {mensagem ? <Aviso tipo="ok">{mensagem}</Aviso> : null}
      {falha ? <Aviso tipo="erro">{falha}</Aviso> : null}

      <section className="bloco card">
        <div className="bloco-titulo">
          <h2>Embarcar passageiros</h2>
          <p>
            Monte a lista de passageiros do voo e confirme tudo de uma vez. Nada é enviado para a
            blockchain antes da confirmação. Se o voo ainda não estiver cadastrado, ele entra junto.
          </p>
        </div>

        <div className="field">
          <label htmlFor="voo">Voo</label>
          <select
            id="voo"
            className={vooEscolhido ? (vooEscolhido.indeniza ? 'voo-atrasa' : 'voo-no-prazo') : ''}
            value={codigo}
            onChange={(evento) => {
              setCodigo(evento.target.value);
              setPendentes([]);
            }}
          >
            <option value="">Selecione um voo</option>
            {voos.map((voo) => (
              <option
                key={voo.codigo}
                value={voo.codigo}
                className={voo.indeniza ? 'voo-atrasa' : 'voo-no-prazo'}
              >
                {voo.indeniza ? '🔴 ATRASADO' : '🟢 NO PRAZO'} · {voo.codigo} · {voo.origem} →{' '}
                {voo.destino} · {voo.indeniza ? `atraso de ${voo.atraso}` : `atraso ${voo.atraso}`}
                {voo.cadastrado ? ' · já cadastrado' : ''}
              </option>
            ))}
          </select>
          <p className="field-hint">
            O desfecho vem da base do oráculo, que já conhece o horário real de chegada. Voos em
            vermelho passam do limite de {dados.regra.limiarHoras} horas e vão indenizar; os verdes
            devolvem a garantia para a companhia.
          </p>
        </div>

        {codigo ? (
          <>
            <form onSubmit={adicionar} className="formulario-embarque">
              <div className="field">
                <label htmlFor="passageiro">Nome do passageiro</label>
                <input
                  id="passageiro"
                  value={nome}
                  onChange={(evento) => setNome(evento.target.value)}
                  placeholder="Insira o nome"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="cpf-passageiro">CPF</label>
                <input
                  id="cpf-passageiro"
                  value={cpf}
                  onChange={(evento) => setCpf(mascaraCpf(evento.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required
                />
              </div>

              <button type="submit" className="btn btn-outline">
                Adicionar à lista
              </button>
            </form>

            {pendentes.length > 0 ? (
              <div className="lista-pendentes">
                <span className="lista-pendentes-titulo">
                  {pendentes.length} passageiro(s) na lista do voo {codigo}
                </span>

                <ul>
                  {pendentes.map((passageiro, indice) => (
                    <li key={`${passageiro.cpf}-${indice}`}>
                      <span className="pendente-nome">{passageiro.nome}</span>
                      <span className="pendente-cpf">{passageiro.cpf}</span>
                      <button
                        type="button"
                        className="pendente-remover"
                        onClick={() => remover(indice)}
                        aria-label={`Remover ${passageiro.nome}`}
                      >
                        remover
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmar}
                  disabled={enviando}
                >
                  {enviando
                    ? 'Registrando na blockchain…'
                    : `Confirmar embarque e depositar ${dados.regra.valor} × ${pendentes.length}`}
                </button>
              </div>
            ) : (
              <Vazio>Adicione ao menos um passageiro para confirmar o embarque.</Vazio>
            )}
          </>
        ) : null}

        <p className="nota-lgpd">
          Nome e CPF ficam no manifesto da companhia, fora da blockchain. Para a cadeia vai apenas o
          hash do CPF.
        </p>
      </section>

      <section className="bloco card">
        <div className="bloco-titulo">
          <h2>Garantias liberadas</h2>
          <p>Voos que chegaram no prazo devolvem a garantia para a companhia sacar.</p>
        </div>

        <div className="resgate">
          <div>
            <span className="resgate-valor">{dados.totais.saldoLiberado}</span>
            <span className="resgate-rotulo">disponível para resgate</span>
          </div>
          <button type="button" className="btn btn-warning" onClick={resgatar} disabled={!temSaldo}>
            Resgatar para a carteira
          </button>
        </div>
      </section>

      <section className="bloco card">
        <div className="bloco-titulo">
          <h2>Voos cadastrados</h2>
          <p>
            {dados.totais.aguardandoOraculo > 0
              ? `${dados.totais.aguardandoOraculo} voo(s) aguardando o oráculo. ` +
                'A apuração acontece sozinha alguns segundos depois do cadastro do voo.'
              : 'Todos os voos já foram apurados pelo oráculo.'}
          </p>
        </div>

        {dados.voos.length === 0 ? (
          <Vazio>Nenhum voo cadastrado ainda. Embarque um passageiro para começar.</Vazio>
        ) : (
          <ul className="lista-voos">
            {dados.voos.map((voo) => (
              <li key={voo.id} className={`voo ${estadoDoVoo(voo)}`}>
                <LinhaVoo voo={voo} />

                <ul className="lista-passageiros">
                  {(voo.bilhetes ?? []).map((bilhete) => (
                    <li key={bilhete.id}>
                      <span className="passageiro-nome">{bilhete.passageiro ?? 'Passageiro'}</span>
                      <span className="passageiro-hash">{bilhete.hashCpfCurto}</span>
                      <span className={`passageiro-estado estado-${bilhete.status.toLowerCase()}`}>
                        {bilhete.status === 'Ativo'
                          ? `${bilhete.garantia} em escrow`
                          : bilhete.indenizado
                            ? `${bilhete.garantia} pagos ao passageiro`
                            : `${bilhete.garantia} devolvidos`}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
