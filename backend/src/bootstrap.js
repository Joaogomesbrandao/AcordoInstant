import path from "node:path";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { JsonStore } from "./store/jsonStore.js";
import { ManualFlightStatusProvider } from "./services/manualFlightStatusProvider.js";
import { BlockchainService } from "./services/blockchainService.js";
import { AcordoInstantService } from "./services/acordoInstantService.js";

dotenv.config();

function normalizeConfig(overrides = {}) {
  const rootDir = process.cwd();

  return {
    host: overrides.host ?? process.env.HOST ?? "127.0.0.1",
    port: Number(overrides.port ?? process.env.PORT ?? 3000),
    providerMode: overrides.providerMode ?? process.env.PROVIDER_MODE ?? "manual",
    dataFile:
      overrides.dataFile ??
      process.env.DATA_FILE ??
      path.join(rootDir, "data", "store.json"),
    contractAddress: overrides.contractAddress ?? process.env.CONTRACT_ADDRESS ?? "",
    rpcUrl: overrides.rpcUrl ?? process.env.RPC_URL ?? "",
    chainId: overrides.chainId ?? (process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : null),
    operatorPrivateKey:
      overrides.operatorPrivateKey ?? process.env.OPERATOR_PRIVATE_KEY ?? ""
  };
}

export function createSystem(overrides = {}) {
  const config = normalizeConfig(overrides);
  const store = new JsonStore(config.dataFile);
  const flightStatusProvider = new ManualFlightStatusProvider(store);
  const blockchainService = new BlockchainService(config);
  const service = new AcordoInstantService({
    store,
    flightStatusProvider,
    blockchainService
  });

  return {
    app: createApp({ service, blockchainService, config }),
    service,
    store,
    flightStatusProvider,
    blockchainService,
    config
  };
}

