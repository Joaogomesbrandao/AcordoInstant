import { useState } from 'react';
import { JsonRpcSigner } from 'ethers';
import { WalletPanel } from './components/WalletPanel';
import { AirlinePanel } from './components/AirlinePanel';
import { PassengerPanel } from './components/PassengerPanel';
import { OraclePanel } from './components/OraclePanel';
import './App.css';

type Tab = 'wallet' | 'airline' | 'passenger' | 'oracle';

export default function App() {
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('wallet');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'wallet', label: 'Conexão' },
    { id: 'airline', label: 'Companhia' },
    { id: 'passenger', label: 'Passageiro' },
    { id: 'oracle', label: 'Oráculo' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>AcordoInstant</h1>
        <p>Seguro paramétrico para atrasos de voos</p>
      </header>

      <nav className="app-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'wallet' && (
          <WalletPanel
            signer={signer}
            walletAddress={walletAddress}
            contractAddress={contractAddress}
            setContractAddress={setContractAddress}
            setSigner={setSigner}
            setWalletAddress={setWalletAddress}
          />
        )}
        {activeTab === 'airline' && (
          <AirlinePanel
            signer={signer}
            walletAddress={walletAddress}
            contractAddress={contractAddress}
          />
        )}
        {activeTab === 'passenger' && (
          <PassengerPanel contractAddress={contractAddress} />
        )}
        {activeTab === 'oracle' && (
          <OraclePanel signer={signer} contractAddress={contractAddress} />
        )}
      </main>

      <footer className="app-footer">
        <p>Protótipo de laboratório — execute o contrato via Remix e conecte a MetaMask.</p>
      </footer>
    </div>
  );
}
