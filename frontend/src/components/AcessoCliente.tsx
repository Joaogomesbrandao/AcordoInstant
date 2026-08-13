import { useEffect, useState } from 'react';
import { ErroApi, cadastrarCliente, entrarCliente } from '../api';
import type { Cliente } from '../tipos';
import { mascaraCpf } from '../utils/formato';
import { Aviso } from './comuns';
import './AcessoCliente.css';

interface CarteiraDeTeste {
  indice: number;
  rotulo: string;
  endereco: string;
}

/**
 * Entrada do cliente: CPF para entrar, ou nome + CPF + chave pública para
 * criar a conta.
 *
 * O cadastro é o momento em que o contrato vincula o hash do CPF à carteira
 * e, com isso, deposita de uma vez qualquer indenização que já estivesse
 * reservada para aquele CPF de voos anteriores. Por isso a tela avisa o
 * valor liberado assim que a conta é criada.
 */
export function AcessoCliente({ aoEntrar }: { aoEntrar: (cliente: Cliente) => void }) {
  const [aba, setAba] = useState<'entrar' | 'criar'>('entrar');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [carteira, setCarteira] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carteiras, setCarteiras] = useState<CarteiraDeTeste[]>([]);

  useEffect(() => {
    fetch('/api/carteiras-de-teste')
      .then((resposta) => (resposta.ok ? resposta.json() : []))
      .then(setCarteiras)
      .catch(() => setCarteiras([]));
  }, []);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      if (aba === 'entrar') {
        aoEntrar(await entrarCliente(cpf));
        return;
      }

      const resultado = await cadastrarCliente({ nome, cpf, carteira });
      aoEntrar(resultado.cliente);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Falha inesperada. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="acesso">
      <div className="acesso-cartao card">
        <div className="acesso-abas">
          <button
            type="button"
            className={aba === 'entrar' ? 'ativa' : ''}
            onClick={() => {
              setAba('entrar');
              setErro(null);
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={aba === 'criar' ? 'ativa' : ''}
            onClick={() => {
              setAba('criar');
              setErro(null);
            }}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={enviar} className="acesso-form">
          {aba === 'criar' ? (
            <div className="field">
              <label htmlFor="nome">Nome completo</label>
              <input
                id="nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Insira o nome"
                required
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="cpf">CPF</label>
            <input
              id="cpf"
              value={cpf}
              onChange={(evento) => setCpf(mascaraCpf(evento.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              required
            />
            <p className="field-hint">
              O CPF identifica você no sistema. Na blockchain entra apenas o hash dele; o número
              nunca é publicado.
            </p>
          </div>

          {aba === 'criar' ? (
            <div className="field">
              <label htmlFor="carteira">Chave pública da sua carteira</label>
              <input
                id="carteira"
                value={carteira}
                onChange={(evento) => setCarteira(evento.target.value)}
                placeholder="0x…"
                list="carteiras-de-teste"
                required
              />
              <datalist id="carteiras-de-teste">
                {carteiras.map((item) => (
                  <option key={item.endereco} value={item.endereco}>
                    {item.rotulo}
                  </option>
                ))}
              </datalist>
              <p className="field-hint">
                É só o endereço público: você não informa chave privada e não assina nada. É nele
                que a indenização é depositada automaticamente.
              </p>
            </div>
          ) : null}

          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

          <button type="submit" className="btn btn-primary acesso-enviar" disabled={enviando}>
            {enviando ? 'Enviando…' : aba === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {aba === 'criar' ? (
          <p className="acesso-rodape">
            Se algum voo seu já atrasou antes deste cadastro, o valor está guardado no contrato em
            nome do seu CPF e cai na sua carteira no momento em que a conta for criada.
          </p>
        ) : null}
      </div>
    </div>
  );
}
