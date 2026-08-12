import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Zera o estado off-chain: clientes cadastrados, manifesto da companhia e
 * arquivos de log.
 *
 * O que está na blockchain não é apagado por aqui — para começar do zero de
 * verdade, reinicie o `npm run chain` (a Hardhat Network não persiste nada
 * em disco) e rode `npm run deploy` de novo.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ALVOS = [
  path.join(RAIZ, "data", "clientes.json"),
  path.join(RAIZ, "data", "manifesto.json"),
  path.join(RAIZ, "logs", "blockchain.log"),
  path.join(RAIZ, "logs", "deploy.log")
];

for (const alvo of ALVOS) {
  await rm(alvo, { force: true });
}

await mkdir(path.join(RAIZ, "data"), { recursive: true });
await mkdir(path.join(RAIZ, "logs"), { recursive: true });

console.log("Estado off-chain zerado: clientes, manifesto e logs.");
