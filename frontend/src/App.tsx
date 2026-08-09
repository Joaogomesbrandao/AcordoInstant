import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { TopBar } from './components/TopBar';
import { ContractGate } from './components/ContractGate';
import { RoleConnectGate } from './components/RoleConnectGate';
import { AirlinePanel } from './components/AirlinePanel';
import { PassengerPanel } from './components/PassengerPanel';
import { useWallet } from './hooks/useWallet';
import { isValidAddress } from './utils/address';
import type { Role } from './types/role';
import './App.css';

export default function App() {
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<Role>('airline');
  const [contractAddress, setContractAddress] = useState('');

  const airlineWallet = useWallet();
  const passengerWallet = useWallet();
  const wallets: Record<Role, ReturnType<typeof useWallet>> = {
    airline: airlineWallet,
    passenger: passengerWallet,
  };

  const hasValidContract = isValidAddress(contractAddress);
  const activeWallet = wallets[activeTab];
  const hasValidWallet = isValidAddress(activeWallet.address);

  function handleEnter(role: Role) {
    setActiveTab(role);
    setEntered(true);
  }

  function handleLogout() {
    airlineWallet.disconnect();
    passengerWallet.disconnect();
    setEntered(false);
  }

  function handleSwitchAccount() {
    activeWallet.connectMetaMask(true);
  }

  if (!entered) {
    return (
      <LoginScreen
        contractAddress={contractAddress}
        onContractChange={setContractAddress}
        wallets={wallets}
        onEnter={handleEnter}
      />
    );
  }

  return (
    <div className="app">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        contractAddress={contractAddress}
        hasValidContract={hasValidContract}
        onContractChange={setContractAddress}
        walletAddress={activeWallet.address}
        onLogout={handleLogout}
        onSwitchAccount={handleSwitchAccount}
      />

      <main className="app-main">
        {!hasValidContract ? (
          <ContractGate value={contractAddress} onSubmit={setContractAddress} />
        ) : !hasValidWallet ? (
          <RoleConnectGate
            role={activeTab}
            connecting={activeWallet.connecting}
            error={activeWallet.error}
            onSubmit={(address) => activeWallet.setAddress(address)}
            onConnectMetaMask={() => activeWallet.connectMetaMask()}
          />
        ) : activeTab === 'airline' ? (
          <AirlinePanel
            signer={airlineWallet.signer}
            walletAddress={airlineWallet.address}
            contractAddress={contractAddress}
          />
        ) : (
          <PassengerPanel
            signer={passengerWallet.signer}
            walletAddress={passengerWallet.address}
            contractAddress={contractAddress}
          />
        )}
      </main>
    </div>
  );
}
