import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { TopBar } from './components/TopBar';
import { PassengerRegisterGate } from './components/PassengerRegisterGate';
import { AirlinePanel } from './components/AirlinePanel';
import { PassengerPanel } from './components/PassengerPanel';
import { usePassengerIdentity } from './hooks/usePassengerIdentity';
import type { Role } from './types/role';
import './App.css';

export default function App() {
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<Role>('airline');

  const passenger = usePassengerIdentity();

  function handleEnter(role: Role) {
    setActiveTab(role);
    setEntered(true);
  }

  function handleLogout() {
    passenger.limpar();
    setEntered(false);
  }

  function handleSwitchUser() {
    passenger.limpar();
  }

  if (!entered) {
    return <LoginScreen onEnter={handleEnter} />;
  }

  return (
    <div className="app">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        passengerIdentity={passenger.identity}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
      />

      <main className="app-main">
        {activeTab === 'airline' ? (
          <AirlinePanel />
        ) : passenger.identity ? (
          <PassengerPanel identity={passenger.identity} />
        ) : (
          <PassengerRegisterGate
            registering={passenger.registering}
            error={passenger.error}
            onSubmit={passenger.registrar}
          />
        )}
      </main>
    </div>
  );
}
