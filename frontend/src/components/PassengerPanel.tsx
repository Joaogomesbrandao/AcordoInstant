import { useState } from 'react';
import { BrowserProvider, Contract, JsonRpcSigner, formatEther } from 'ethers';
import { CONTRACT_ABI } from '../contract';
import { apiUrl } from '../utils/api';
import './PassengerPanel.css';

interface PassengerPanelProps {
  signer: JsonRpcSigner | null;
  walletAddress: string;
  contractAddress: string;
}

interface SearchedFlight {
  id: string;
  horarioPartida: number;
  horarioChegada: number;
  totalPassageiros: string;
  jaInscrito: boolean;
}

interface MyFlight {
  vooId: string;
  horarioPartida: number;
  horarioChegada: number;
  atrasoHorasInformado: string;
  atrasoHorasOficial: string;
  pago: boolean;
}

// Espelha a regra fixa do contrato (LIMIAR_ATRASO_HORAS / VALOR_MULTA) só para
// exibir uma estimativa no histórico, sem precisar de uma chamada extra por voo.
function estimatePenalty(atrasoHorasOficial: number): string {
  return atrasoHorasOficial > 2 ? '0.01' : '0';
}

// Uma indenização já foi solicitada para este voo quando o passageiro chegou
// a assinar `registrarAtraso` — o contrato não guarda um flag explícito para
// isso, então usamos como indício o atraso oficial (ou já ter sido pago).
function jaSolicitou(flight: MyFlight): boolean {
  return flight.pago || Number(flight.atrasoHorasOficial) > 0 || Number(flight.atrasoHorasInformado) > 0;
}

function formatDateTime(unixSeconds: number): string {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function PassengerPanel({ signer, walletAddress, contractAddress }: PassengerPanelProps) {
  const [searchVooId, setSearchVooId] = useState('');
  const [searchedFlight, setSearchedFlight] = useState<SearchedFlight | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [myFlights, setMyFlights] = useState<MyFlight[] | null>(null);
  const [myFlightsLoading, setMyFlightsLoading] = useState(false);

  const [claimVooId, setClaimVooId] = useState('');
  const [informedDelay, setInformedDelay] = useState('');
  const [officialDelay, setOfficialDelay] = useState<number | null>(null);
  const [penalty, setPenalty] = useState('0');
  const [claimLoading, setClaimLoading] = useState(false);

  function getContract() {
    if (!signer) return null;
    return new Contract(contractAddress, CONTRACT_ABI, signer);
  }

  function getReadContract() {
    if (!window.ethereum) return null;
    const provider = new BrowserProvider(window.ethereum);
    return new Contract(contractAddress, CONTRACT_ABI, provider);
  }

  async function handleSearchFlight() {
    if (!searchVooId) return;

    setSearchLoading(true);
    setMessage('');
    setSearchedFlight(null);

    try {
      const readContract = getReadContract();
      if (!readContract) {
        setMessage('Nenhum provedor Web3 disponível neste navegador para consultar o contrato.');
        return;
      }

      const voo = await readContract.consultarVoo(searchVooId);
      const inscricao = await readContract.consultarInscricao(searchVooId, walletAddress);

      setSearchedFlight({
        id: voo.id.toString(),
        horarioPartida: Number(voo.horarioPartida),
        horarioChegada: Number(voo.horarioChegada),
        totalPassageiros: voo.totalPassageiros.toString(),
        jaInscrito: inscricao.inscrito,
      });
    } catch (err) {
      console.error(err);
      setMessage('Voo não encontrado. Confira o número do voo e o endereço do contrato.');
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleEnroll() {
    if (!searchedFlight) return;

    setEnrollLoading(true);
    setMessage('');

    try {
      const contract = getContract();
      if (!contract) {
        setMessage('Esta identidade não tem uma carteira conectada — use "preencher com a MetaMask" para assinar transações.');
        return;
      }

      const tx = await contract.inscreverNoVoo(searchedFlight.id);
      await tx.wait();

      setMessage(`Inscrição confirmada no voo ${searchedFlight.id}.`);
      setSearchedFlight({ ...searchedFlight, jaInscrito: true });
      await loadMyFlights();
    } catch (err) {
      console.error(err);
      setMessage('Erro ao se inscrever no voo.');
    } finally {
      setEnrollLoading(false);
    }
  }

  async function loadMyFlights() {
    setMyFlightsLoading(true);
    try {
      const readContract = getReadContract();
      if (!readContract) {
        setMessage('Nenhum provedor Web3 disponível neste navegador para consultar o contrato.');
        return;
      }

      const ids: bigint[] = await readContract.listarVoosDoPassageiro(walletAddress);
      const rows = await Promise.all(
        ids.map(async (id) => {
          const [voo, inscricao] = await Promise.all([
            readContract.consultarVoo(id),
            readContract.consultarInscricao(id, walletAddress),
          ]);
          return {
            vooId: voo.id.toString(),
            horarioPartida: Number(voo.horarioPartida),
            horarioChegada: Number(voo.horarioChegada),
            atrasoHorasInformado: inscricao.atrasoHorasInformado.toString(),
            atrasoHorasOficial: inscricao.atrasoHorasOficial.toString(),
            pago: inscricao.pago,
          };
        })
      );
      setMyFlights(rows.reverse());
    } catch (err) {
      console.error(err);
      setMessage('Erro ao carregar seus voos.');
    } finally {
      setMyFlightsLoading(false);
    }
  }

  function handleStartClaim(vooId: string) {
    setClaimVooId(vooId);
    setInformedDelay('');
    setOfficialDelay(null);
    setPenalty('0');
    setMessage('');
    document.getElementById('informed-delay')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleFetchOfficialDelay() {
    if (!claimVooId) return;

    setClaimLoading(true);
    setMessage('');

    try {
      const response = await fetch(apiUrl(`/voos/${claimVooId}/consultar`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passageiro: walletAddress }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.erro || 'Erro ao consultar atraso oficial');
      }

      const data: { atrasoHorasOficial: number } = await response.json();
      setOfficialDelay(data.atrasoHorasOficial);

      const readContract = getReadContract();
      if (readContract) {
        const multa = await readContract.calcularMulta(data.atrasoHorasOficial);
        setPenalty(formatEther(multa));
      } else {
        setPenalty(estimatePenalty(data.atrasoHorasOficial));
      }
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : 'Erro ao consultar atraso oficial.');
    } finally {
      setClaimLoading(false);
    }
  }

  async function registerDelay(vooId: string, atrasoInformado: number, atrasoOficial: number) {
    const contract = getContract();
    if (!contract) {
      setMessage('Esta identidade não tem uma carteira conectada — use "preencher com a MetaMask" para assinar transações.');
      return false;
    }

    const tx = await contract.registrarAtraso(vooId, atrasoInformado, atrasoOficial);
    const receipt = await tx.wait();

    const iface = contract.interface;
    let result = `Atraso do voo ${vooId} registrado.`;

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
    await loadMyFlights();
    return true;
  }

  async function handleConfirmClaim() {
    if (!claimVooId || officialDelay === null) return;

    setClaimLoading(true);
    setMessage('');

    try {
      const ok = await registerDelay(claimVooId, Number(informedDelay) || 0, officialDelay);
      if (ok) {
        setClaimVooId('');
        setInformedDelay('');
        setOfficialDelay(null);
        setPenalty('0');
      }
    } catch (err) {
      console.error(err);
      setMessage('Erro ao registrar atraso. Verifique se você está inscrito neste voo.');
    } finally {
      setClaimLoading(false);
    }
  }

  async function handleRetryPayment(flight: MyFlight) {
    setClaimLoading(true);
    setMessage('');

    try {
      await registerDelay(flight.vooId, Number(flight.atrasoHorasInformado), Number(flight.atrasoHorasOficial));
    } catch (err) {
      console.error(err);
      setMessage('Erro ao tentar registrar o pagamento novamente.');
    } finally {
      setClaimLoading(false);
    }
  }

  const claimedFlights = myFlights ? myFlights.filter(jaSolicitou) : null;

  return (
    <div className="panel">
      <section className="stripe stripe-cream">
        <div className="stripe-inner">
          <span className="page-eyebrow" style={{ color: 'var(--color-teal-dark)' }}>
            Passageiro
          </span>
          <h1 className="page-title">Painel do passageiro</h1>
          <p className="page-description">
            Inscreva-se nos seus voos e, em caso de atraso, confirme o valor
            oficial apurado pelo Oracle para receber sua indenização.
          </p>

          <div className="stat-inline-row">
            <div className="stat-inline-item">
              <span className="stat-inline-value">{myFlights ? myFlights.length : '—'}</span>
              <span className="stat-inline-label">Voos em que você está inscrito</span>
            </div>
            <div className="stat-inline-divider" />
            <div className="stat-inline-item">
              <span className="stat-inline-value">{claimedFlights ? claimedFlights.length : '—'}</span>
              <span className="stat-inline-label">Indenizações solicitadas</span>
            </div>
          </div>
        </div>
      </section>

      <section className="stripe stripe-plain">
        <div className="stripe-inner">
          <h2 className="section-title">
            <span className="section-title-row">
              <span className="step-number">1</span> Inscrever-se em um voo
            </span>
          </h2>
          <div className="form-row">
            <div className="field">
              <label htmlFor="flight-id">Número do voo</label>
              <input
                id="flight-id"
                type="number"
                min="0"
                value={searchVooId}
                onChange={(e) => setSearchVooId(e.target.value)}
                placeholder="1234"
              />
            </div>
            <button className="btn btn-outline" onClick={handleSearchFlight} disabled={searchLoading || !searchVooId}>
              {searchLoading ? 'Consultando...' : 'Consultar'}
            </button>
          </div>

          {searchedFlight && (
            <div className="info-box">
              <div className="info-row">
                <span>Partida</span>
                <span>{formatDateTime(searchedFlight.horarioPartida)}</span>
              </div>
              <div className="info-row">
                <span>Chegada</span>
                <span>{formatDateTime(searchedFlight.horarioChegada)}</span>
              </div>
              <div className="info-row">
                <span>Passageiros inscritos</span>
                <span>{searchedFlight.totalPassageiros}</span>
              </div>
              {searchedFlight.jaInscrito ? (
                <p className="hint-text">Você já está inscrito neste voo.</p>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '0.9rem' }}
                  onClick={handleEnroll}
                  disabled={enrollLoading}
                >
                  {enrollLoading ? 'Inscrevendo...' : 'Inscrever-se neste voo'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="stripe stripe-teal">
        <div className="stripe-inner">
          <h2 className="section-title">
            <span className="section-title-row">
              <span className="step-number">2</span> Meus voos
            </span>
            <span className="section-title-hint">Acompanhe os voos em que você está inscrito.</span>
          </h2>

          <button className="btn btn-outline btn-sm" onClick={loadMyFlights} disabled={myFlightsLoading}>
            {myFlightsLoading ? 'Carregando...' : 'Carregar meus voos'}
          </button>

          {myFlights && myFlights.length === 0 && (
            <p className="empty-text">Você ainda não se inscreveu em nenhum voo.</p>
          )}

          {myFlights && myFlights.length > 0 && (
            <ul className="flight-list">
              {myFlights.map((flight) => {
                const solicitado = jaSolicitou(flight);
                const semDireito = solicitado && !flight.pago && Number(flight.atrasoHorasOficial) <= 2;
                const aguardandoPagamento = solicitado && !flight.pago && Number(flight.atrasoHorasOficial) > 2;

                return (
                  <li key={flight.vooId} className="flight-item">
                    <div className="flight-row">
                      <div className="flight-row-main">
                        <span className="flight-id">Voo {flight.vooId}</span>
                        <span className="flight-times">
                          {formatDateTime(flight.horarioPartida)} → {formatDateTime(flight.horarioChegada)}
                        </span>
                      </div>

                      {flight.pago && <span className="badge badge-success">Indenizado</span>}

                      {semDireito && <span className="badge badge-neutral">Sem direito a indenização</span>}

                      {aguardandoPagamento && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRetryPayment(flight)}
                          disabled={claimLoading}
                        >
                          {claimLoading ? 'Tentando...' : 'Tentar pagamento novamente'}
                        </button>
                      )}

                      {!solicitado && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleStartClaim(flight.vooId)}>
                          Indicar atraso
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="stripe stripe-gold">
        <div className="stripe-inner">
          <h2 className="section-title">
            <span className="section-title-row">
              <span className="step-number">3</span> Indicar atraso e solicitar indenização
            </span>
            <span className="section-title-hint">
              Informe o voo e quantas horas você percebeu de atraso, depois busque o valor
              oficial apurado pelo Oracle para confirmar a indenização.
            </span>
          </h2>

          <div className="form-row">
            <div className="field">
              <label htmlFor="claim-voo-id">Número do voo</label>
              <input
                id="claim-voo-id"
                type="number"
                min="0"
                value={claimVooId}
                onChange={(e) => {
                  setClaimVooId(e.target.value);
                  setOfficialDelay(null);
                  setPenalty('0');
                }}
                placeholder="1234"
              />
            </div>
            <div className="field">
              <label htmlFor="informed-delay">Quantas horas você acha que atrasou?</label>
              <input
                id="informed-delay"
                type="number"
                min="0"
                value={informedDelay}
                onChange={(e) => setInformedDelay(e.target.value)}
                placeholder="3"
              />
            </div>
          </div>
          <p className="field-hint">
            O valor informado fica registrado como referência, mas não é usado no cálculo do pagamento.
          </p>

          <button
            className="btn btn-outline btn-sm"
            onClick={handleFetchOfficialDelay}
            disabled={claimLoading || !claimVooId}
          >
            {claimLoading ? 'Consultando...' : 'Buscar atraso oficial'}
          </button>

          {officialDelay !== null && (
            <div className="info-box official-delay-box">
              <div className="info-row">
                <span>Atraso oficial (Oracle)</span>
                <span>{officialDelay} horas</span>
              </div>
              <div className="info-row">
                <span>Indenização estimada</span>
                <span className="penalty-value">{penalty} ETH</span>
              </div>
              <button
                className="btn btn-warning btn-sm"
                style={{ marginTop: '0.75rem' }}
                onClick={handleConfirmClaim}
                disabled={claimLoading}
              >
                {claimLoading ? 'Registrando...' : 'Confirmar e registrar atraso'}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="stripe stripe-accent">
        <div className="stripe-inner">
          <h2 className="section-title">
            <span className="section-title-row">
              <span className="step-number">4</span> Minhas indenizações solicitadas
            </span>
            <span className="section-title-hint">Histórico dos atrasos que você já registrou neste contrato.</span>
          </h2>

          {!myFlights && <p className="empty-text">Carregue seus voos no passo 2 para ver o histórico.</p>}

          {claimedFlights && claimedFlights.length === 0 && (
            <p className="empty-text">Você ainda não solicitou nenhuma indenização.</p>
          )}

          {claimedFlights && claimedFlights.length > 0 && (
            <ul className="flight-list">
              {claimedFlights.map((flight) => (
                <li key={flight.vooId} className="flight-item">
                  <div className="flight-row">
                    <div className="flight-row-main">
                      <span className="flight-id">Voo {flight.vooId}</span>
                      <span className="flight-times">
                        {formatDateTime(flight.horarioPartida)} → {formatDateTime(flight.horarioChegada)}
                      </span>
                    </div>
                    {flight.pago ? (
                      <span className="badge badge-success">Pago</span>
                    ) : Number(flight.atrasoHorasOficial) > 2 ? (
                      <span className="badge badge-warning">Aguardando saldo da companhia</span>
                    ) : (
                      <span className="badge badge-neutral">Sem direito a indenização</span>
                    )}
                  </div>
                  <div className="info-row">
                    <span>Atraso informado por você</span>
                    <span>{flight.atrasoHorasInformado} horas</span>
                  </div>
                  <div className="info-row">
                    <span>Atraso oficial (Oracle)</span>
                    <span>{flight.atrasoHorasOficial} horas</span>
                  </div>
                  <div className="info-row">
                    <span>Valor da indenização</span>
                    <span className="penalty-value">{estimatePenalty(Number(flight.atrasoHorasOficial))} ETH</span>
                  </div>
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
