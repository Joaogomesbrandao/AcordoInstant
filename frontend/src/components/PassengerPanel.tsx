import { useState } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { CONTRACT_ABI } from '../contract';
import './PassengerPanel.css';

interface VooInfo {
  id: string;
  empresa: string;
  passageiro: string;
  atrasoHoras: string;
  pago: boolean;
}

interface PassengerPanelProps {
  contractAddress: string;
}

export function PassengerPanel({ contractAddress }: PassengerPanelProps) {
  const [vooId, setVooId] = useState('');
  const [delayHours, setDelayHours] = useState('');
  const [vooInfo, setVooInfo] = useState<VooInfo | null>(null);
  const [penalty, setPenalty] = useState<string>('0');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCheckFlight() {
    if (!contractAddress || !vooId) return;
    if (!window.ethereum) {
      alert('MetaMask não está instalada.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const provider = new BrowserProvider(window.ethereum);
      const readContract = new Contract(contractAddress, CONTRACT_ABI, provider);
      const voo = await readContract.consultarVoo(vooId);

      setVooInfo({
        id: voo.id.toString(),
        empresa: voo.empresa,
        passageiro: voo.passageiro,
        atrasoHoras: voo.atrasoHoras.toString(),
        pago: voo.pago,
      });
      setMessage('Voo consultado com sucesso.');
    } catch (err) {
      console.error(err);
      setMessage('Voo não encontrado ou erro na consulta.');
      setVooInfo(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculatePenalty() {
    if (!contractAddress || !delayHours) return;
    if (!window.ethereum) {
      alert('MetaMask não está instalada.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const provider = new BrowserProvider(window.ethereum);
      const readContract = new Contract(contractAddress, CONTRACT_ABI, provider);
      const multa = await readContract.calcularMulta(delayHours);
      setPenalty(formatEther(multa));
      setMessage('Multa calculada com base no atraso informado.');
    } catch (err) {
      console.error(err);
      setMessage('Erro ao calcular multa.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel passenger-panel">
      <div className="panel-card">
        <h2 className="panel-title">Área do Passageiro</h2>

        <div className="action-group">
          <label htmlFor="flight-id">Número do voo</label>
          <input
            id="flight-id"
            type="number"
            min="0"
            value={vooId}
            onChange={(e) => setVooId(e.target.value)}
            placeholder="1234"
          />
          <button className="btn btn-primary" onClick={handleCheckFlight} disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar voo'}
          </button>
        </div>

        {vooInfo && (
          <div className="info-box">
            <p><strong>Voo:</strong> {vooInfo.id}</p>
            <p><strong>Empresa:</strong> {vooInfo.empresa}</p>
            <p><strong>Passageiro:</strong> {vooInfo.passageiro}</p>
            <p><strong>Atraso:</strong> {vooInfo.atrasoHoras} horas</p>
            <p>
              <strong>Status:</strong>{' '}
              <span className={vooInfo.pago ? 'status-paid' : 'status-pending'}>
                {vooInfo.pago ? 'Indenizado' : 'Pendente'}
              </span>
            </p>
          </div>
        )}

        <div className="action-group">
          <label htmlFor="delay-hours">Horas de atraso</label>
          <input
            id="delay-hours"
            type="number"
            min="0"
            value={delayHours}
            onChange={(e) => setDelayHours(e.target.value)}
            placeholder="3"
          />
          <button className="btn btn-outline" onClick={handleCalculatePenalty} disabled={loading}>
            Calcular indenização
          </button>
        </div>

        {penalty !== '0' && (
          <div className="penalty-box">
            <span className="penalty-label">Indenização estimada</span>
            <span className="penalty-value">{penalty} ETH</span>
          </div>
        )}

        {message && <p className="panel-message">{message}</p>}
      </div>
    </section>
  );
}
