import { useEffect, useState } from 'react';
import {
  companhiaCadastrarVoo,
  companhiaConsultarSaldo,
  companhiaDepositarFundo,
  companhiaInscreverPassageiro,
  companhiaListarVoos,
  companhiaResgatarFundo,
  listarPassageiros,
  type Passageiro,
  type VooResumo,
} from '../api';
import './AirlinePanel.css';

function formatDateTime(unixSeconds: number): string {
  if (!unixSeconds) return '-';
  return new Date(unixSeconds * 1000).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * A companhia é única e fixa: suas chaves ficam só no backend, então este
 * painel nunca lida com carteira/assinatura, só chama o backend, que é
 * quem assina as transações em nome da companhia.
 */
export function AirlinePanel() {
  const [balance, setBalance] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [flightId, setFlightId] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [flights, setFlights] = useState<VooResumo[] | null>(null);
  const [flightsLoading, setFlightsLoading] = useState(false);

  const [passengers, setPassengers] = useState<Passageiro[]>([]);
  const [enrollFlightId, setEnrollFlightId] = useState('');
  const [selectedPassengerId, setSelectedPassengerId] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);

  useEffect(() => {
    listarPassageiros()
      .then(setPassengers)
      .catch(() => setPassengers([]));
  }, []);

  async function handleConsultBalance() {
    try {
      const { saldoEth } = await companhiaConsultarSaldo();
      setBalance(saldoEth);
    } catch (err) {
      setMessage(friendlyError(err, 'Erro ao consultar saldo.'));
    }
  }

  async function loadFlights() {
    setFlightsLoading(true);
    try {
      const voos = await companhiaListarVoos();
      setFlights(voos);
    } catch (err) {
      setMessage(friendlyError(err, 'Erro ao carregar voos cadastrados.'));
    } finally {
      setFlightsLoading(false);
    }
  }

  async function handleDeposit() {
    if (!depositAmount) return;

    setLoading(true);
    setMessage('');

    try {
      await companhiaDepositarFundo(depositAmount);
      setMessage(`Depósito de ${depositAmount} ETH realizado.`);
      setDepositAmount('');
      await handleConsultBalance();
    } catch (err) {
      setMessage(friendlyError(err, 'Erro ao depositar fundos.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!withdrawAmount) return;

    setLoading(true);
    setMessage('');

    try {
      await companhiaResgatarFundo(withdrawAmount);
      setMessage(`Resgate de ${withdrawAmount} ETH realizado.`);
      setWithdrawAmount('');
      await handleConsultBalance();
    } catch (err) {
      setMessage(friendlyError(err, 'Erro ao resgatar fundos.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterFlight() {
    if (!flightId || !departureTime || !arrivalTime) return;

    setLoading(true);
    setMessage('');

    try {
      const horarioPartida = Math.floor(new Date(departureTime).getTime() / 1000);
      const horarioChegada = Math.floor(new Date(arrivalTime).getTime() / 1000);

      await companhiaCadastrarVoo(flightId, horarioPartida, horarioChegada);

      setMessage(`Voo ${flightId} cadastrado com sucesso.`);
      setFlightId('');
      setDepartureTime('');
      setArrivalTime('');
      await loadFlights();
    } catch (err) {
      setMessage(friendlyError(err, 'Erro ao cadastrar voo. Verifique os horários e se o número do voo já não está em uso.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrollPassenger() {
    if (!enrollFlightId || !selectedPassengerId) return;

    setEnrollLoading(true);
    setMessage('');

    try {
      await companhiaInscreverPassageiro(enrollFlightId, Number(selectedPassengerId));

      const passageiro = passengers.find((p) => String(p.id) === selectedPassengerId);
      setMessage(`${passageiro?.name ?? 'Passageiro'} inscrito no voo ${enrollFlightId}.`);
      setSelectedPassengerId('');
      setEnrollFlightId('');
      await loadFlights();
    } catch (err) {
      setMessage(friendlyError(err, 'Erro ao inscrever o passageiro. Verifique se o voo existe e se ele já não está inscrito.'));
    } finally {
      setEnrollLoading(false);
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
            Deposite o fundo de garantia, cadastre os horários dos seus voos
            e inscreva os passageiros neles pelo nome.
          </p>

          <div className="stat-inline-row">
            <div className="stat-inline-item">
              <span className="stat-inline-value">{flights ? flights.length : '-'}</span>
              <span className="stat-inline-label">Voos cadastrados</span>
            </div>
            <div className="stat-inline-divider" />
            <div className="stat-inline-item">
              <span className="stat-inline-value">{balance !== null ? `${balance} ETH` : '-'}</span>
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
            <span className="section-title-hint">A companhia usa sua identidade fixa automaticamente.</span>
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

      <section className="stripe stripe-teal">
        <div className="stripe-inner">
          <h2 className="section-title">
            <span className="section-title-row">Inscrever passageiro em um voo</span>
            <span className="section-title-hint">
              Escolha um passageiro já cadastrado pelo nome e o voo em que ele vai viajar.
            </span>
          </h2>

          {passengers.length === 0 && (
            <p className="empty-text">
              Nenhum passageiro cadastrado ainda. Peça para ele se cadastrar na tela de login.
            </p>
          )}

          {passengers.length > 0 && (
            <>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="enroll-passenger">Passageiro</label>
                  <select
                    id="enroll-passenger"
                    value={selectedPassengerId}
                    onChange={(e) => setSelectedPassengerId(e.target.value)}
                  >
                    <option value="">Selecione um passageiro</option>
                    {passengers.map((passenger) => (
                      <option key={passenger.id} value={passenger.id}>
                        {passenger.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="enroll-flight-id">Número do voo</label>
                  <input
                    id="enroll-flight-id"
                    type="number"
                    min="0"
                    value={enrollFlightId}
                    onChange={(e) => setEnrollFlightId(e.target.value)}
                    placeholder="1234"
                  />
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleEnrollPassenger}
                disabled={enrollLoading || !enrollFlightId || !selectedPassengerId}
              >
                {enrollLoading ? 'Inscrevendo...' : 'Inscrever passageiro'}
              </button>
            </>
          )}
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
