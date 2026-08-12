import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import dotenv from "dotenv";

dotenv.config();

/**
 * Configuração do Hardhat para o AcordoInstant.
 *
 * A rede é local, como pede o escopo do protótipo:
 *
 * - `hardhat`   : rede simulada em memória, usada por `npm test`;
 * - `localhost` : nó levantado com `npm run chain` (127.0.0.1:8545), onde o
 *                 contrato é implantado e onde backend, oráculo e frontend
 *                 trabalham.
 *
 * As contas vêm do mnemônico padrão do Hardhat, o mesmo que
 * `deploy/contas.js` usa para derivar os papéis (companhia, oráculo, TJPB e
 * plataforma) e as cinco carteiras de teste. É por isso que ninguém precisa
 * copiar chave privada para nenhum arquivo.
 *
 * A proposta prevê a Rede Blockchain Brasil (permissionada) em produção; o
 * que muda lá é o endpoint e a governança dos nós, não o contrato.
 */
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
    }
  }
};
