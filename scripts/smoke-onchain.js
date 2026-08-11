import { rm } from "node:fs/promises";
import path from "node:path";
import { JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers";
import { createSystem } from "../backend/src/bootstrap.js";

/**
 * Smoke test ponta-a-ponta contra o contrato ja implantado.
 *
 * Reproduz exatamente o caminho que a interface percorre — painel da
 * companhia (depositar fundo, cadastrar voo, inscrever passageiro), Oracle
 * (semear o atraso oficial) e painel do passageiro (consultar o atraso e
 * confirmar a solicitacao) — e confere o resultado on-chain: saldo do
 * escrow, saldo do passageiro e estado da inscricao.
 *
 * Requer o no local rodando (`npx hardhat node`), o contrato implantado
 * (`npm run deploy:local`) e o .env preenchido.
 *
 *   npm run smoke:onchain
 */
const VALOR_MULTA = parseEther("0.01");

async function main() {
  const tempFile = path.join(process.cwd(), "data", "store.smoke.json");
  await rm(tempFile, { force: true });

  const { app, config, flightContractService } = createSystem({
    dataFile: tempFile,
    port: 3102
  });

  if (!flightContractService.isConfigured()) {
    throw new Error(
      "Defina RPC_URL, CONTRACT_ADDRESS e OPERATOR_PRIVATE_KEY no .env antes de rodar o smoke on-chain."
    );
  }

  // cacheTimeout: -1 para que as leituras de saldo antes/depois do pagamento
  // nao venham do cache interno do ethers.
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId || undefined, {
    cacheTimeout: -1
  });
  const companhia = new Wallet(config.operatorPrivateKey).address;

  const server = await new Promise((resolve) => {
    const instance = app.listen(3102, "127.0.0.1", () => resolve(instance));
  });
  const baseUrl = "http://127.0.0.1:3102";

  try {
    console.log(`Contrato:  ${config.contractAddress}`);
    console.log(`Companhia: ${companhia}`);

    const saldoEscrowInicial = (await get(`${baseUrl}/companhia/saldo`)).saldoEth;
    console.log(`Escrow antes: ${saldoEscrowInicial} ETH`);

    await post(`${baseUrl}/companhia/depositar-fundo`, { valorEth: "0.05" });
    console.log("1. Fundo de garantia depositado (0.05 ETH).");

    // Cenario A: atraso de 4h -> indenizacao paga.
    // Cenario B: atraso de 30min -> registrado, sem direito a pagamento.
    const pago = await cenario({
      baseUrl,
      provider,
      titulo: "atraso de 4h (acima do limiar)",
      delayMinutes: 240,
      esperaPagamento: true
    });

    const naoPago = await cenario({
      baseUrl,
      provider,
      titulo: "atraso de 30min (abaixo do limiar)",
      delayMinutes: 30,
      esperaPagamento: false
    });

    const saldoEscrowFinal = (await get(`${baseUrl}/companhia/saldo`)).saldoEth;
    console.log("");
    console.log(`Escrow depois: ${saldoEscrowFinal} ETH`);
    console.log(`Voo pago:      ${pago.vooId} (tx ${pago.txHash})`);
    console.log(`Voo sem multa: ${naoPago.vooId} (tx ${naoPago.txHash})`);
    console.log("");
    console.log("Smoke on-chain concluido com sucesso.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    provider.destroy();
    await rm(tempFile, { force: true });
  }
}

async function cenario({ baseUrl, provider, titulo, delayMinutes, esperaPagamento }) {
  console.log("");
  console.log(`--- Cenario: ${titulo} ---`);

  // Numero do voo derivado do relogio: o no local mantem o estado entre
  // execucoes, entao reaproveitar o mesmo id reverteria com "Voo ja cadastrado".
  const vooId = String(Date.now() % 1_000_000_000);
  const partida = Math.floor(Date.now() / 1000) + 3600;
  const chegada = partida + 7200;
  const passageiroEndereco = Wallet.createRandom().address;

  const passageiro = await post(`${baseUrl}/api/passengers`, {
    name: `Passageiro ${vooId}`,
    walletAddress: passageiroEndereco
  });

  await post(`${baseUrl}/companhia/voos`, {
    vooId,
    horarioPartida: partida,
    horarioChegada: chegada
  });
  console.log(`2. Voo ${vooId} cadastrado on-chain.`);

  await post(`${baseUrl}/companhia/voos/${vooId}/inscrever`, {
    passengerId: passageiro.id
  });
  console.log(`3. Passageiro ${passageiroEndereco} inscrito pela companhia.`);

  // O Oracle semeia o atraso oficial na fonte mockada, como faz
  // `node oracle/oracle.js --flight <voo> --delay <minutos>`.
  await post(`${baseUrl}/api/internal/flight-status`, {
    flightNumber: vooId,
    status: "LANDED",
    delayMinutes,
    sourceName: "smoke-onchain"
  });
  console.log(`4. Oracle registrou ${delayMinutes} minutos de atraso.`);

  const consulta = await post(`${baseUrl}/voos/${vooId}/consultar`, {
    passageiro: passageiroEndereco
  });
  console.log(`5. Atraso oficial lido pelo painel: ${consulta.atrasoHorasOficial}h.`);

  const saldoAntes = await provider.getBalance(passageiroEndereco);
  const resultado = await post(`${baseUrl}/voos/${vooId}/registrar-atraso`, {
    passageiroEndereco,
    atrasoHorasInformado: 3,
    atrasoHorasOficial: consulta.atrasoHorasOficial
  });
  const saldoDepois = await provider.getBalance(passageiroEndereco);

  console.log(`6. Resultado: pago=${resultado.pago} | ${resultado.mensagem}`);
  console.log(`   Saldo do passageiro: ${formatEther(saldoDepois)} ETH`);

  const recebido = saldoDepois - saldoAntes;
  const esperado = esperaPagamento ? VALOR_MULTA : 0n;

  if (resultado.pago !== esperaPagamento) {
    throw new Error(
      `Esperava pago=${esperaPagamento} para ${titulo}, recebi pago=${resultado.pago} (${resultado.mensagem})`
    );
  }

  if (recebido !== esperado) {
    throw new Error(
      `Esperava transferencia de ${formatEther(esperado)} ETH, houve ${formatEther(recebido)} ETH`
    );
  }

  return { vooId, txHash: resultado.txHash, passageiroEndereco };
}

async function get(url) {
  return unwrap(await fetch(url));
}

async function post(url, body) {
  return unwrap(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

async function unwrap(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.erro ?? payload.error ?? "Falha no smoke on-chain");
  }

  return payload;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
