import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { network } from "hardhat";

/**
 * Implanta o SeguroParametrico.sol na rede escolhida e registra o endereco.
 *
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * A primeira conta da rede (a mesma que assina o deploy) e a carteira da
 * companhia aerea do prototipo: e ela que o backend usa em
 * OPERATOR_PRIVATE_KEY para depositar o fundo, cadastrar voos, inscrever
 * passageiros e registrar atrasos.
 *
 * Alem de imprimir o endereco, o script grava deployments/<rede>.json com os
 * dados da implantacao (endereco, rede, chainId, bloco, hash da transacao),
 * que e o "endereco do contrato documentado" exigido nos entregaveis.
 */
async function main() {
  const connection = await network.create();
  const { ethers, networkName } = connection;

  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const saldo = await ethers.provider.getBalance(deployer.address);

  console.log(`Rede:      ${networkName} (chainId ${chainId})`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Saldo:     ${ethers.formatEther(saldo)} ETH`);

  if (saldo === 0n) {
    throw new Error(
      "A conta que assina o deploy esta sem saldo nativo para pagar o gas."
    );
  }

  const fabrica = await ethers.getContractFactory("SeguroParametrico");
  const contrato = await fabrica.deploy();
  await contrato.waitForDeployment();

  const endereco = await contrato.getAddress();
  const tx = contrato.deploymentTransaction();
  const recibo = tx ? await tx.wait() : null;

  console.log("");
  console.log(`SeguroParametrico implantado em: ${endereco}`);
  console.log(`Transacao: ${tx?.hash ?? "-"} (bloco ${recibo?.blockNumber ?? "-"})`);
  console.log(`Limiar de atraso: ${await contrato.LIMIAR_ATRASO_HORAS()} horas`);
  console.log(`Indenizacao: ${ethers.formatEther(await contrato.VALOR_MULTA())} ETH`);

  const registro = {
    contrato: "SeguroParametrico",
    endereco,
    rede: networkName,
    chainId,
    deployer: deployer.address,
    txHash: tx?.hash ?? null,
    bloco: recibo?.blockNumber ?? null,
    implantadoEm: new Date().toISOString()
  };

  const arquivo = path.join(process.cwd(), "deployments", `${networkName}.json`);
  await mkdir(path.dirname(arquivo), { recursive: true });
  await writeFile(arquivo, `${JSON.stringify(registro, null, 2)}\n`, "utf8");
  console.log(`Registro da implantacao salvo em ${path.relative(process.cwd(), arquivo)}`);

  console.log("");
  console.log("Configure os .env com os valores abaixo:");
  console.log("  .env (raiz)");
  console.log(`    CONTRACT_ADDRESS=${endereco}`);
  console.log("  frontend/.env");
  console.log(`    VITE_CONTRACT_ADDRESS=${endereco}`);

  await connection.close?.();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
