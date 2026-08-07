import { BrowserProvider, JsonRpcSigner } from 'ethers';
import './WalletPanel.css';

interface WalletPanelProps {
  signer: JsonRpcSigner | null;
  walletAddress: string;
  contractAddress: string;
  setContractAddress: (value: string) => void;
  setSigner: (signer: JsonRpcSigner | null) => void;
  setWalletAddress: (address: string) => void;
}

export function WalletPanel({
  signer,
  walletAddress,
  contractAddress,
  setContractAddress,
  setSigner,
  setWalletAddress,
}: WalletPanelProps) {
  async function connectWallet() {
    if (!window.ethereum) {
      alert('MetaMask não está instalada. Instale a extensão para continuar.');
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const newSigner = await provider.getSigner();
      const address = await newSigner.getAddress();

      setSigner(newSigner);
      setWalletAddress(address);
    } catch (err) {
      console.error('Erro ao conectar carteira:', err);
      alert('Não foi possível conectar a carteira.');
    }
  }

  function disconnectWallet() {
    setSigner(null);
    setWalletAddress('');
  }

  return (
    <section className="wallet-panel">
      <div className="wallet-card">
        <h2 className="wallet-title">Conexão</h2>

        <div className="contract-field">
          <label htmlFor="contract-address">Endereço do Contrato</label>
          <input
            id="contract-address"
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="0x..."
          />
          <p className="field-hint">Cole o endereço do contrato deployado no Remix.</p>
        </div>

        <div className="wallet-actions">
          {!signer ? (
            <button className="btn btn-primary" onClick={connectWallet}>
              Conectar MetaMask
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={disconnectWallet}>
              Desconectar
            </button>
          )}
        </div>

        {walletAddress && (
          <div className="wallet-info">
            <p>
              <strong>Carteira conectada:</strong>
            </p>
            <p className="wallet-address">{walletAddress}</p>
          </div>
        )}
      </div>
    </section>
  );
}
