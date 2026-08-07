import { useState } from 'react';
import { BrowserProvider, Contract, JsonRpcSigner, parseEther, formatEther } from 'ethers';
import { CONTRACT_ABI } from '../contract';
import './AirlinePanel.css';

interface AirlinePanelProps {
  signer: JsonRpcSigner | null;
  walletAddress: string;
  contractAddress: string;
}

export function AirlinePanel({ signer, walletAddress, contractAddress }: AirlinePanelProps) {
  const [balance, setBalance] = useState<string>('0');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  function getContract() {
    if (!signer) return null;
    return new Contract(contractAddress, CONTRACT_ABI, signer);
  }

  async function handleConsultBalance() {
    if (!signer || !contractAddress) {
      alert('Conecte a carteira e informe o endereço do contrato.');
      return;
    }

    if (!window.ethereum) {
      alert('MetaMask não está instalada.');
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const readContract = new Contract(contractAddress, CONTRACT_ABI, provider);
      const saldo = await readContract.consultarSaldo(walletAddress);
      setBalance(formatEther(saldo));
      setMessage('Saldo consultado com sucesso.');
    } catch (err) {
      console.error(err);
      setMessage('Erro ao consultar saldo.');
    }
  }

  async function handleDeposit() {
    if (!signer || !contractAddress || !depositAmount) return;

    setLoading(true);
    setMessage('');

    try {
      const contract = getContract();
      if (!contract) throw new Error('Contrato não inicializado');

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
    if (!signer || !contractAddress || !withdrawAmount) return;

    setLoading(true);
    setMessage('');

    try {
      const contract = getContract();
      if (!contract) throw new Error('Contrato não inicializado');

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

  return (
    <section className="panel airline-panel">
      <div className="panel-card">
        <h2 className="panel-title">Área da Companhia Aérea</h2>

        <div className="balance-row">
          <div className="balance-box">
            <span className="balance-label">Saldo em escrow</span>
            <span className="balance-value">{balance} ETH</span>
          </div>
          <button className="btn btn-outline" onClick={handleConsultBalance}>
            Atualizar saldo
          </button>
        </div>

        <div className="action-group">
          <label htmlFor="deposit">Depositar fundos (ETH)</label>
          <input
            id="deposit"
            type="number"
            step="0.001"
            min="0"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="0.01"
          />
          <button className="btn btn-primary" onClick={handleDeposit} disabled={loading}>
            {loading ? 'Processando...' : 'Depositar'}
          </button>
        </div>

        <div className="action-group">
          <label htmlFor="withdraw">Resgatar fundos (ETH)</label>
          <input
            id="withdraw"
            type="number"
            step="0.001"
            min="0"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="0.01"
          />
          <button className="btn btn-danger" onClick={handleWithdraw} disabled={loading}>
            {loading ? 'Processando...' : 'Resgatar'}
          </button>
        </div>

        {message && <p className="panel-message">{message}</p>}
      </div>
    </section>
  );
}
