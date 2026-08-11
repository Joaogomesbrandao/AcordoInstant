import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import dotenv from "dotenv";

dotenv.config();

/**
 * Configuracao do Hardhat para o AcordoInstant.
 *
 * Redes disponiveis:
 * - `hardhat`  : rede simulada em memoria, usada por `npx hardhat test`;
 * - `localhost`: no local levantado com `npx hardhat node` (127.0.0.1:8545),
 *                que e a rede de testes usada pelo backend, pelo oracle e
 *                pelo frontend nas demonstracoes;
 * - `sepolia`  : testnet publica; so funciona se SEPOLIA_RPC_URL e
 *                SEPOLIA_PRIVATE_KEY estiverem definidos no .env.
 */
const sepoliaAccounts = process.env.SEPOLIA_PRIVATE_KEY
  ? [process.env.SEPOLIA_PRIVATE_KEY]
  : [];

export default {
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: process.env.RPC_URL || "http://127.0.0.1:8545"
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: sepoliaAccounts
    }
  }
};
