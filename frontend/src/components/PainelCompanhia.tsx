import { useCallback, useEffect, useState } from 'react';
import { ErroApi, embarcarPassageiro, painelDaCompanhia, resgatarGarantias, voosDisponiveis } from '../api';
import { usePainel } from '../hooks/usePainel';
import type { VooDisponivel } from '../tipos';
import { dataHora, mascaraCpf } from '../utils/formato';
import { Aviso, FaixaRegra, Hash, Indicadores, LinhaVoo, Vazio } from './comuns';
import './painel.css';

/**
 * Dashboard da companhia aérea.
 *
 * A companhia faz duas coisas: embarca o passageiro (o que trava a garantia
 * no escrow) e resgata as garantias dos voos que chegaram no prazo. Ela não
 * declara atraso nem decide pagamento — isso é do oráculo e do contrato.
 */
export function PainelCompanhia() {
  const { dados, erro, carregando, atualizar } = usePainel(painelDaCompanhia);

  const [voos, setVoos] = useState<VooDisponivel[]>([]);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const recarregarVoos = useCallback(() => {
    voosDisponiveis()
      .then(setVoos)
      .catch(() => setVoos([]));
  }, []);

  useEffect(recarregarVoos, [recarregarVoos]);

  async function embarcar(evento: React.FormEvent) {
    evento.preventDefault();
    setMensagem(null);
    setFalha(null);
    setEnviando(true);

    try {
      const resultado = await embarcarPassageiro({ codigo, nome, cpf });
      setMensagem(
        `${resultado.passageiro} embarcado no voo ${resultado.codigo}. ` +
          `Garantia de ${resultado.garantia} depositada no escrow.`,
      );
      setNome('');
      setCpf('');
      await atualizar();
      recarregarVoos();
    } catch (erroEnvio) {
      setFalha(erroEnvio instanceof ErroApi ? erroEnvio.message : 'Falha ao embarcar passageiro.');
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
        itens={[
          { valor: dados.totais.voos, rotulo: 'Voos cadastrados' },
          { valor: dados.totais.passageiros, rotulo: 'Passageiros a bordo' },
          { valor: dados.totais.atrasados, rotulo: 'Voos atrasados' },
          { valor: dados.totais.pontuais, rotulo: 'Voos no prazo' },
          { valor: dados.totais.emEscrow, rotulo: 'Em escrow' },
          { valor: dados.totais.totalIndenizado, rotulo: 'Já indenizado' },
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
          <h2>Embarcar passageiro</h2>
          <p>
            Registra a passagem no contrato e deposita a garantia. Se o voo ainda não estiver na
            blockchain, ele é cadastrado junto.
          </p>
        </div>

        <form onSubmit={embarcar} className="formulario-embarque">
          <div className="field">
            <label htmlFor="voo">Voo</label>
            <select id="voo" value={codigo} onChange={(evento) => setCodigo(evento.target.value)} required>
              <option value="">Selecione um voo</option>
              {voos.map((voo) => (
                <option key={voo.codigo} value={voo.codigo}>
                  {voo.codigo} · {voo.origem} → {voo.destino} · chegada{' '}
                  {dataHora(voo.chegadaPrevista)}
                  {voo.cadastrado ? ' · já cadastrado' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="passageiro">Nome do passageiro</label>
            <input
              id="passageiro"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Ana Souza"
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

          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Registrando…' : `Embarcar e depositar ${dados.regra.valor}`}
          </button>
        </form>

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
          <p>{dados.totais.aguardandoOraculo} aguardando apuração do oráculo.</p>
        </div>

        {dados.voos.length === 0 ? (
          <Vazio>Nenhum voo cadastrado ainda. Embarque um passageiro para começar.</Vazio>
        ) : (
          <ul className="lista-voos">
            {dados.voos.map((voo) => (
              <li key={voo.id} className="voo">
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
