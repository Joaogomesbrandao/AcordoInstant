import { useState } from 'react';
import { BrowserProvider, Contract, JsonRpcSigner, parseEther, formatEther } from 'ethers';
import { CONTRACT_ABI } from '../contract';
import './AirlinePanel.css';

interface AirlinePanelProps {
  signer: JsonRpcSigner | null;
  walletAddress: string;
  contractAddress: string;
}

interface FlightRow {
  id: string;
  horarioPartida: number;
  horarioChegada: number;
  totalPassageiros: string;
}

function formatDateTime(unixSeconds: number): string {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function AirlinePanel({ signer, walletAddress, contractAddress }: AirlinePanelProps) {
  const [balance, setBalance] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [flightId, setFlightId] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [flights, setFlights] = useState<FlightRow[] | null>(null);
  const [flightsLoading, setFlightsLoading] = useState(false);

  function getContract() {
    if (!signer) return null;
    return new Contract(contractAddress, CONTRACT_ABI, signer);
  }

  function getReadContract() {
    if (!window.ethereum) return null;
    const provider = new BrowserProvider(window.ethereum);
    return new Contract(contractAddress, CONTRACT_ABI, provider);
  }

  async function handleConsultBalance() {
    try {
      const readContract = getReadContract();
      if (!readContract) {
        setMessage('Nenhum provedor Web3 disponível neste navegador para consultar o contrato.');
        return;
      }
      const saldo = await readContract.consultarSaldo(walletAddress);
      setBalance(formatEther(saldo));
    } catch (err) {
      console.error(err);
      setMessage('Erro ao consultar saldo. Verifique se o endereço do contrato está correto.');
    }
  }

  async function loadFlights() {
    setFlightsLoading(true);
    try {
      const readContract = getReadContract();
      if (!readContract) {
        setMessage('Nenhum provedor Web3 disponível neste navegador para consultar o contrato.');
        return;
      }

      const ids: bigint[] = await readContract.listarVoosDaEmpresa(walletAddress);
      const rows = await Promise.all(
        ids.map(async (id) => {
          const voo = await readContract.consultarVoo(id);
          return {
            id: voo.id.toString(),
            horarioPartida: Number(voo.horarioPartida),
            horarioChegada: Number(voo.horarioChegada),
            totalPassageiros: voo.totalPassageiros.toString(),
          };
        })
      );
      setFlights(rows.reverse());
    } catch (err) {
      console.error(err);
      setMessage('Erro ao carregar voos cadastrados.');
    } finally {
      setFlightsLoading(false);
    }
  }

  async function handleDeposit() {
    if (!depositAmount) return;

    setLoading(true);
    setMessage('');

    try {
      const contract = getContract();
      if (!contract) {
        setMessage('Esta identidade não tem uma carteira conectada — use "preencher com a MetaMask" para assinar transações.');
        return;
      }

      const tx = await contract.depositarFundo({ value: parseEther(depositAmount) });
      await tx.wait();

      setMessage(`Depósito de ${depositAmount} ETH realizado.`);
      setDepositAmount('');
      await handleConsultBalance();
    } catch (err) {
      console.error(err);
      setMessage('Erro ao depositar fundos.');
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!withdrawAmount) return;

    setLoading(true);
    setMessage('');

    try {
      const contract = getContract();
      if (!contract) {
        setMessage('Esta identidade não tem uma carteira conectada — use "preencher com a MetaMask" para assinar transações.');
        return;
      }

      const tx = await contract.resgatarFundo(parseEther(withdrawAmount));
      await tx.wait();

      setMessage(`Resgate de ${withdrawAmount} ETH realizado.`);
      setWithdrawAmount('');
      await handleConsultBalance();
    } catch (err) {
      console.error(err);
      setMessage('Erro ao resgatar fundos.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterFlight() {
    if (!flightId || !departureTime || !arrivalTime) return;

    setLoading(true);
    setMessage('');

    try {
      const contract = getContract();
      if (!contract) {
        setMessage('Esta identidade não tem uma carteira conectada — use "preencher com a MetaMask" para assinar transações.');
        return;
      }

      const horarioPartida = Math.floor(new Date(departureTime).getTime() / 1000);
      const horarioChegada = Math.floor(new Date(arrivalTime).getTime() / 1000);

      const tx = await contract.cadastrarVoo(flightId, horarioPartida, horarioChegada);
      await tx.wait();

      setMessage(`Voo ${flightId} cadastrado com sucesso.`);
      setFlightId('');
      setDepartureTime('');
      setArrivalTime('');
      await loadFlights();
    } catch (err) {
      console.error(err);
      setMessage('Erro ao cadastrar voo. Verifique os horários e se o número do voo já não está em uso.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <section className="stripe stripe-cream">
        <div className="stripe-inner">
          <span className="page-eyebrow" style={{ color: 'var(--color-navy)' }}>
            Companhia aérea
          </span>
          <h1 className="page-title">Painel da companhia</h1>
          <p className="page-description">
            Deposite o fundo de garantia e cadastre os horários dos seus voos.
            Os passageiros se inscrevem por conta própria depois disso.
          </p>

          <div className="stat-inline-row">
            <div className="stat-inline-item">
              <span className="stat-inline-value">{flights ? flights.length : '—'}</span>
              <span className="stat-inline-label">Voos cadastrados</span>
            </div>
            <div className="stat-inline-divider" />
            <div className="stat-inline-item">
              <span className="stat-inline-value">{balance !== null ? `${balance} ETH` : '—'}</span>
              <span className="stat-inline-label">Fundo disponível</span>
            </div>
          </div>
        </div>
      </section>

      <section className="stripe stripe-plain">
        <div className="stripe-inner">
          <h2 className="section-title">
            <span className="section-title-row">Fundo de garantia</span>
            <span className="section-title-hint">Saldo depositado em escrow para cobrir indenizações.</span>
          </h2>

          <div className="balance-row">
            <button className="btn btn-outline btn-sm" onClick={handleConsultBalance}>
              Atualizar saldo
            </button>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="deposit">Depositar (ETH)</label>
              <input
                id="deposit"
                type="number"
                step="0.001"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.01"
              />
            </div>
            <button className="btn btn-primary" onClick={handleDeposit} disabled={loading}>
              {loading ? 'Processando...' : 'Depositar'}
            </button>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="withdraw">Resgatar (ETH)</label>
              <input
                id="withdraw"
                type="number"
                step="0.001"
                min="0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.01"
              />
            </div>
            <button className="btn btn-danger" onClick={handleWithdraw} disabled={loading}>
              {loading ? 'Processando...' : 'Resgatar'}
            </button>
          </div>
        </div>
      </section>

      <section className="stripe stripe-navy">
        <div className="stripe-inner">
          <h2 className="section-title">
            <span className="section-title-row">Cadastrar voo</span>
            <span className="section-title-hint">A carteira conectada é usada como identidade da companhia.</span>
          </h2>

          <div className="field">
            <label htmlFor="flight-id">Número do voo</label>
            <input
              id="flight-id"
              type="number"
              min="0"
              value={flightId}
              onChange={(e) => setFlightId(e.target.value)}
              placeholder="1234"
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="departure-time">Horário de partida</label>
              <input
                id="departure-time"
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="arrival-time">Horário de chegada</label>
              <input
                id="arrival-time"
                type="datetime-local"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
              />
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleRegisterFlight}
            disabled={loading || !flightId || !departureTime || !arrivalTime}
          >
            {loading ? 'Cadastrando...' : 'Cadastrar voo'}
          </button>
        </div>
      </section>

      <section className="stripe stripe-gold">
        <div className="stripe-inner">
          <h2 className="section-title">
            <span className="section-title-row">Meus voos</span>
            <span className="section-title-hint">Voos cadastrados por esta companhia.</span>
          </h2>

          <button className="btn btn-outline btn-sm" onClick={loadFlights} disabled={flightsLoading}>
            {flightsLoading ? 'Carregando...' : 'Carregar voos'}
          </button>

          {flights && flights.length === 0 && (
            <p className="empty-text">Nenhum voo cadastrado ainda.</p>
          )}

          {flights && flights.length > 0 && (
            <ul className="flight-list">
              {flights.map((flight) => (
                <li key={flight.id} className="flight-row">
                  <div className="flight-row-main">
                    <span className="flight-id">Voo {flight.id}</span>
                    <span className="flight-times">
                      {formatDateTime(flight.horarioPartida)} → {formatDateTime(flight.horarioChegada)}
                    </span>
                  </div>
                  <span className="badge badge-success">
                    {flight.totalPassageiros} passageiro{flight.totalPassageiros === '1' ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {message && (
        <section className="stripe stripe-plain stripe-message">
          <div className="stripe-inner">
            <p className="panel-message">{message}</p>
          </div>
        </section>
      )}
    </div>
  );
}
