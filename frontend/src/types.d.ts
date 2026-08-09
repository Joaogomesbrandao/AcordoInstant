import type { Eip1193Provider } from 'ethers';

interface MetaMaskEthereumProvider extends Eip1193Provider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeListener(event: string, listener: (...args: any[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: MetaMaskEthereumProvider;
  }
}

export {};
