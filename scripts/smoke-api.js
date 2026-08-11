import { rm } from "node:fs/promises";
import path from "node:path";
import { createSystem } from "../backend/src/bootstrap.js";

async function main() {
  const tempFile = path.join(process.cwd(), "data", "store.smoke.json");
  await rm(tempFile, { force: true });

  // Este smoke cobre a camada de apolices da API (store + provider de status),
  // nao a integracao on-chain: o BlockchainService usado por ela aponta para um
  // contrato de apolices (criarApolice/registrarStatusOficial) que nao e o
  // SeguroParametrico.sol implantado. Zerar o contractAddress mantem o servico
  // em modo "prepared" mesmo com o .env preenchido — o fluxo on-chain de
  // verdade, o que a interface usa, e coberto por scripts/smoke-onchain.js.
  const { app } = createSystem({
    dataFile: tempFile,
    port: 3101,
    contractAddress: ""
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(3101, "127.0.0.1", () => resolve(instance));
  });

  try {
    const baseUrl = "http://127.0.0.1:3101";

    const company = await post(`${baseUrl}/api/companies`, {
      name: "Companhia Teste",
      walletAddress: "0x1000000000000000000000000000000000000001"
    });

    const passenger = await post(`${baseUrl}/api/passengers`, {
      name: "Passageiro Teste",
      walletAddress: "0x2000000000000000000000000000000000000002"
    });

    const policy = await post(`${baseUrl}/api/policies`, {
      companyId: company.id,
      passengerId: passenger.id,
      flightNumber: "JJ1234",
      ticketReference: "BILHETE-001",
      termsText: "Se atraso >= 180 minutos, pagar 0.01 ether",
      thresholdMinutes: 180,
      compensationWei: "10000000000000000"
    });

    await post(`${baseUrl}/api/policies/${policy.id}/accept`, {
      passengerId: passenger.id
    });

    await post(`${baseUrl}/api/internal/flight-status`, {
      flightNumber: "JJ1234",
      status: "LANDED",
      delayMinutes: 240
    });

    const settlement = await post(
      `${baseUrl}/api/policies/${policy.id}/process-settlement`,
      {}
    );

    if (settlement.policy.state !== "eligible_pending_blockchain") {
      throw new Error("Estado inesperado no smoke test");
    }

    console.log("Smoke test concluido com sucesso.");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await rm(tempFile, { force: true });
  }
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Falha no smoke test");
  }

  return payload;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
