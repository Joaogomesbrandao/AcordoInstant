import { useCallback, useState } from 'react';
import { ErroApi, painelDoCliente, sacarPendentes } from '../api';
import { usePainel } from '../hooks/usePainel';
import type { Cliente } from '../tipos';
import { dataHora, estadoDoVoo } from '../utils/formato';
import { Aviso, FaixaRegra, Hash, Indicadores, LinhaVoo, Vazio } from './comuns';
import './painel.css';

/**
 * Dashboard do passageiro.
 *
 * Não há botão de saque em lugar nenhum, e isso é o desenho da solução: a
 * indenização é depositada direto na carteira quando o oráculo confirma o
 * atraso. A tela serve para acompanhar os voos e conferir quanto já foi
 * pago, por voo e no total.
 */
export function PainelCliente({ cliente }: { cliente: Cliente }) {
  const carregar = useCallback(() => painelDoCliente(cliente.cpfDigitos), [cliente.cpfDigitos]);
  const { dados, erro, carregando, atualizar } = usePainel(carregar);

  const [sacando, setSacando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  async function sacar() {
    setMensagem(null);
    setFalha(null);
    setSacando(true);

    try {
      const resultado = await sacarPendentes(cliente.cpfDigitos);
      setMensagem(
        `${resultado.valor} depositados na sua carteira. ` +
          'A partir de agora, toda indenização cai automaticamente, sem você pedir.',
      );
      await atualizar();
    } catch (erroSaque) {
      setFalha(erroSaque instanceof ErroApi ? erroSaque.message : 'Falha ao sacar os valores.');
    } finally {
      setSacando(false);
    }
  }

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
        colunas={3}
        itens={[
          { valor: dados.totais.depositado, rotulo: 'Já depositado na sua carteira' },
          { valor: dados.totais.viagens, rotulo: 'Voos segurados' },
          { valor: dados.totais.indenizadas, rotulo: 'Voos indenizados' },
        ]}
      />

      {/*
        Some assim que o saque é confirmado: é um valor único, apurado
        enquanto este CPF ainda não tinha carteira vinculada. Daí em diante
        não há mais nada a solicitar.
      */}
      {dados.totais.temPendencia ? (
        <div className="pendencia">
          <div>
            <span className="pendencia-valor">{dados.totais.pendente}</span>
            <p className="pendencia-texto">
              Este valor foi apurado em voos seus que atrasaram antes de você criar a conta, e ficou
              guardado no contrato em nome do seu CPF. Saque uma vez para recebê-lo. Depois disso,
              toda indenização é depositada automaticamente na sua carteira.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={sacar} disabled={sacando}>
            {sacando ? 'Depositando…' : 'Receber valores pendentes'}
          </button>
        </div>
      ) : null}

      {mensagem ? <Aviso tipo="ok">{mensagem}</Aviso> : null}
      {falha ? <Aviso tipo="erro">{falha}</Aviso> : null}

      <FaixaRegra
        regra={dados.regra}
        nota="Você não precisa solicitar nada: o pagamento é automático e cai direto na sua carteira."
      />

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
              <li key={viagem.bilheteId} className={`voo ${estadoDoVoo(viagem.voo)}`}>
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
