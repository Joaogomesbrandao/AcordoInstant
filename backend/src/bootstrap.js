import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { JsonStore } from "./store/jsonStore.js";
import { ManualFlightStatusProvider } from "./services/manualFlightStatusProvider.js";
import { BlockchainService } from "./services/blockchainService.js";
import { FlightContractService } from "./services/flightContractService.js";
import { AcordoInstantService } from "./services/acordoInstantService.js";

dotenv.config();

function normalizeConfig(overrides = {}) {
  const rootDir = process.cwd();
  const frontendDistDir =
    overrides.frontendDistDir ??
    process.env.FRONTEND_DIST_DIR ??
    path.join(rootDir, "frontend", "dist");
  const frontendIndexFile = path.join(frontendDistDir, "index.html");

  return {
    host: overrides.host ?? process.env.HOST ?? "127.0.0.1",
    // 3001 por padrao: o frontend (Vite) ja ocupa a porta 3000.
    port: Number(overrides.port ?? process.env.PORT ?? 3001),
    providerMode: overrides.providerMode ?? process.env.PROVIDER_MODE ?? "manual",
    dataFile:
      overrides.dataFile ??
      process.env.DATA_FILE ??
      path.join(rootDir, "data", "store.json"),
    contractAddress: overrides.contractAddress ?? process.env.CONTRACT_ADDRESS ?? "",
    rpcUrl: overrides.rpcUrl ?? process.env.RPC_URL ?? "",
    chainId: overrides.chainId ?? (process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : null),
    operatorPrivateKey:
      overrides.operatorPrivateKey ?? process.env.OPERATOR_PRIVATE_KEY ?? "",
    frontendDistDir,
    frontendIndexFile,
    serveFrontend:
      overrides.serveFrontend ??
      (process.env.SERVE_FRONTEND
        ? process.env.SERVE_FRONTEND === "true"
        : existsSync(frontendIndexFile))
  };
}

export function createSystem(overrides = {}) {
  const config = normalizeConfig(overrides);
  const store = new JsonStore(config.dataFile);
  const flightStatusProvider = new ManualFlightStatusProvider(store);
  const blockchainService = new BlockchainService(config);
  const flightContractService = new FlightContractService(config);
  const service = new AcordoInstantService({
    store,
    flightStatusProvider,
    blockchainService,
    flightContractService
  });

  return {
    app: createApp({ service, blockchainService, flightContractService, config }),
    service,
    store,
    flightStatusProvider,
    blockchainService,
    flightContractService,
    config
  };
}
