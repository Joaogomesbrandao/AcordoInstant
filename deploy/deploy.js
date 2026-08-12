import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

import { carteirasDeTeste, enderecosDosPapeis } from "./contas.js";
import { criarLogger } from "../lib/logger.js";
import { brl, curto, eth, numero } from "../lib/formato.js";

/**
 * Implanta o SeguroVoo na rede local e deixa o sistema pronto para uso.
 *
 *     npm run deploy
 *
 * Além de publicar o contrato, o script:
 *   1. deriva as carteiras dos quatro papéis (companhia, oráculo, TJPB e
 *      plataforma) e as cinco carteiras de teste dos passageiros;
 *   2. grava `deployments/<rede>.json` com o registro da implantação;
 *   3. gera `frontend/src/rede.config.ts` com o endereço do contrato.
 *
 * O passo 3 é o que evita copiar endereço à mão para o `.env`: o backend lê
 * o registro da implantação e o frontend importa o arquivo gerado, então
 * implantar de novo já reconfigura as duas pontas.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const log = criarLogger("deploy.log");

async function main() {
  const conexao = await network.create();
  const { ethers, networkName } = conexao;

  const papeis = enderecosDosPapeis();
  const usuarios = carteirasDeTeste();

  const [implantador] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const saldo = await ethers.provider.getBalance(implantador.address);

  log.secao(
    "AcordoInstant · implantacao",
    `rede ${networkName} (chainId ${chainId}) · seguro parametrico de atraso de voo`
  );

  if (saldo === 0n) {
    throw new Error("A conta que assina o deploy esta sem saldo para pagar o gas.");
  }

  if (implantador.address.toLowerCase() !== papeis.companhia.endereco.toLowerCase()) {
    log.aviso(
      `A conta que assina o deploy (${curto(implantador.address)}) nao e a carteira ` +
        `da companhia (${curto(papeis.companhia.endereco)}).`
    );
  }

  // --- Papéis da rede -------------------------------------------------------

  log.simples("  Carteiras institucionais");
  for (const [papel, definicao] of Object.entries(papeis)) {
    const saldoPapel = await ethers.provider.getBalance(definicao.endereco);
    log.simples(
      `    #${definicao.indice} ${definicao.nome.padEnd(16)} ${definicao.endereco}  ${eth(saldoPapel)}`
    );
    log.simples(`       ${definicao.resumo}`);
  }
  log.simples("");

  log.simples("  Carteiras de teste dos passageiros (nenhuma cadastrada no sistema)");
  for (const usuario of usuarios) {
    log.simples(`    #${usuario.indice} ${usuario.rotulo.padEnd(19)} ${usuario.endereco}`);
  }
  log.simples("");

  // --- Implantação ----------------------------------------------------------

  const fabrica = await ethers.getContractFactory("SeguroVoo");
  const contrato = await fabrica.deploy(
    papeis.oraculo.endereco,
    papeis.tjpb.endereco,
    papeis.plataforma.endereco
  );
  await contrato.waitForDeployment();

  const endereco = await contrato.getAddress();
  const transacao = contrato.deploymentTransaction();
  const recibo = transacao ? await transacao.wait() : null;

  log.evento({
    rotulo: "CONTRATO IMPLANTADO",
    cor: "verde",
    resumo: `SeguroVoo em ${endereco}`,
    detalhes: [
      transacao?.hash ? `tx ${curto(transacao.hash)}` : null,
      recibo?.blockNumber != null ? `bloco ${recibo.blockNumber}` : null,
      recibo?.gasUsed != null ? `gas ${numero(recibo.gasUsed)}` : null
    ]
  });

  const [limiarHoras, valorWei] = await contrato.regraContrato();
  log.evento({
    rotulo: "REGRA REGISTRADA",
    cor: "magenta",
    resumo: `atraso acima de ${limiarHoras}h ⇒ ${brl(valorWei)} por passageiro`,
    detalhes: [`garantia exigida por bilhete ${eth(valorWei)}`]
  });

  // --- Registro da implantação ---------------------------------------------

  const registro = {
    contrato: "SeguroVoo",
    endereco,
    rede: networkName,
    chainId,
    rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
    implantadoPor: implantador.address,
    txHash: transacao?.hash ?? null,
    bloco: recibo?.blockNumber ?? null,
    implantadoEm: new Date().toISOString(),
    regra: {
      limiarAtrasoHoras: Number(limiarHoras),
      indenizacaoWei: valorWei.toString(),
      indenizacaoReais: brl(valorWei)
    },
    papeis: Object.fromEntries(
      Object.entries(papeis).map(([papel, definicao]) => [papel, definicao.endereco])
    ),
    usuariosDeTeste: usuarios.map(({ indice, rotulo, endereco: conta }) => ({
      indice,
      rotulo,
      endereco: conta
    }))
  };

  const arquivoRegistro = path.join(RAIZ, "deployments", `${networkName}.json`);
  await mkdir(path.dirname(arquivoRegistro), { recursive: true });
  await writeFile(arquivoRegistro, `${JSON.stringify(registro, null, 2)}\n`, "utf8");

  log.evento({
    rotulo: "REGISTRO GRAVADO",
    cor: "azul",
    resumo: path.relative(RAIZ, arquivoRegistro),
    detalhes: ["lido pelo backend e pelo oraculo, sem configuracao manual"]
  });

  // --- Configuração do frontend --------------------------------------------

  const arquivoFrontend = path.join(RAIZ, "frontend", "src", "rede.config.ts");
  const conteudoFrontend = `// Arquivo gerado por deploy/deploy.js — nao editar a mao.
// Regerado a cada 'npm run deploy'.
export const REDE = {
  nome: '${networkName}',
  chainId: ${chainId},
  rpcUrl: '${registro.rpcUrl}',
  contrato: '${endereco}',
  implantadoEm: '${registro.implantadoEm}',
} as const;
`;

  await writeFile(arquivoFrontend, conteudoFrontend, "utf8");
  log.evento({
    rotulo: "FRONTEND CONFIGURADO",
    cor: "azul",
    resumo: path.relative(RAIZ, arquivoFrontend),
    detalhes: ["endereco do contrato injetado automaticamente"]
  });

  log.simples("");
  log.simples("  Proximo passo: npm run dev");
  log.simples("");

  await conexao.close?.();
}

main().catch((erro) => {
  log.erro(erro.message ?? String(erro));
  console.error(erro);
  process.exitCode = 1;
});
