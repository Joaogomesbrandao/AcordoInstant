import { useState } from 'react';
import { Contract, JsonRpcSigner } from 'ethers';
import { CONTRACT_ABI } from '../contract';
import './OraclePanel.css';

interface OraclePanelProps {
  signer: JsonRpcSigner | null;
  contractAddress: string;
}

export function OraclePanel({ signer, contractAddress }: OraclePanelProps) {
  const [vooId, setVooId] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [passageiro, setPassageiro] = useState('');
  const [delayVooId, setDelayVooId] = useState('');
  const [delayHours, setDelayHours] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function getContract() {
    if (!signer) return null;
    return new Contract(contractAddress, CONTRACT_ABI, signer);
  }

  async function handleRegisterFlight() {
    if (!signer || !contractAddress || !vooId || !empresa || !passageiro) return;

    setLoading(true);
    setMessage('');

    try {
      const contract = getContract();
      if (!contract) throw new Error('Contrato não inicializado');

      const tx = await contract.cadastrarVoo(vooId, empresa, passageiro);
      await tx.wait();

      setMessage(`Voo ${vooId} cadastrado com sucesso.`);
      setVooId('');
      setEmpresa('');
      setPassageiro('');
    } catch (err) {
      console.error(err);
      setMessage('Erro ao cadastrar voo. Verifique se está usando a carteira do oráculo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterDelay() {
    if (!signer || !contractAddress || !delayVooId || !delayHours) return;

    setLoading(true);
    setMessage('');

    try {
      const contract = getContract();
      if (!contract) throw new Error('Contrato não inicializado');

      const tx = await contract.registrarAtraso(delayVooId, delayHours);
      const receipt = await tx.wait();

      const iface = contract.interface;
      let result = `Atraso do voo ${delayVooId} registrado.`;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'PagamentoRealizado') {
            result += ' Pagamento realizado.';
          }
          if (parsed?.name === 'QuitacaoEmitida') {
            result += ' Quitação emitida.';
          }
        } catch {
          // ignore unknown logs
        }
      }

      setMessage(result);
      setDelayVooId('');
      setDelayHours('');
    } catch (err) {
      console.error(err);
      setMessage('Erro ao registrar atraso. Verifique se está usando a carteira do oráculo e se há saldo suficiente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel oracle-panel">
      <div className="panel-card">
        <h2 className="panel-title">Área do Oráculo</h2>
        <p className="panel-subtitle">
          Somente a carteira autorizada como oráculo pode executar essas ações.
        </p>

        <div className="action-group">
          <label htmlFor="oracle-flight-id">Cadastrar voo</label>
          <input
            id="oracle-flight-id"
            type="number"
            min="0"
            value={vooId}
            onChange={(e) => setVooId(e.target.value)}
            placeholder="Número do voo"
          />
          <input
            type="text"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Endereço da empresa (0x...)"
          />
          <input
            type="text"
            value={passageiro}
            onChange={(e) => setPassageiro(e.target.value)}
            placeholder="Endereço do passageiro (0x...)"
          />
          <button className="btn btn-primary" onClick={handleRegisterFlight} disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar voo'}
          </button>
        </div>

        <div className="action-group">
          <label htmlFor="delay-flight-id">Registrar atraso</label>
          <input
            id="delay-flight-id"
            type="number"
            min="0"
            value={delayVooId}
            onChange={(e) => setDelayVooId(e.target.value)}
            placeholder="Número do voo"
          />
          <input
            type="number"
            min="0"
            value={delayHours}
            onChange={(e) => setDelayHours(e.target.value)}
            placeholder="Horas de atraso"
          />
          <button className="btn btn-warning" onClick={handleRegisterDelay} disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar atraso'}
          </button>
        </div>

        {message && <p className="panel-message">{message}</p>}
      </div>
    </section>
  );
}
