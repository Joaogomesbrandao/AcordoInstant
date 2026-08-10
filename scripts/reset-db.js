import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STATE } from "../backend/src/store/jsonStore.js";

// Roda antes de "npm start" e "npm run dev" (via prestart/predev no
// package.json) para garantir que toda inicializacao comeca com um banco
// zerado, sem passageiros/companhias/apolices de execucoes anteriores.
async function main() {
  const dataFile =
    process.env.DATA_FILE ?? path.join(process.cwd(), "data", "store.json");

  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(DEFAULT_STATE, null, 2)}\n`, "utf8");

  console.log(`Banco de dados resetado: ${dataFile}`);
}

main().catch((error) => {
  console.error("Falha ao resetar o banco de dados:", error.message);
  process.exitCode = 1;
});
