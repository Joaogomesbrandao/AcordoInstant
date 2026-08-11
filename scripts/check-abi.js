import { readFile } from "node:fs/promises";
import path from "node:path";
import { Interface } from "ethers";

/**
 * Confere se os ABIs mantidos a mao batem com o contrato compilado.
 *
 * O frontend (frontend/src/contract.ts) e o backend
 * (backend/src/services/flightContractService.js) guardam suas proprias
 * copias do ABI. Quando o contrato muda e uma dessas copias fica para tras,
 * o sintoma e silencioso: leituras retornam campos indefinidos e eventos
 * deixam de ser reconhecidos no recibo da transacao. Este script quebra
 * antes disso acontecer.
 *
 *   npm run compile && npm run check:abi
 */
const ARTIFACT = path.join(
  process.cwd(),
  "artifacts",
  "contracts",
  "SeguroParametrico.sol",
  "SeguroParametrico.json"
);

async function abiDoContrato() {
  const artifact = JSON.parse(await readFile(ARTIFACT, "utf8"));
  return new Interface(artifact.abi);
}

async function abiDoFrontend() {
  const arquivo = path.join(process.cwd(), "frontend", "src", "contract.ts");
  const fonte = await readFile(arquivo, "utf8");
  const json = fonte
    .replace(/^\s*export const CONTRACT_ABI\s*=\s*/, "")
    .replace(/;\s*$/, "");
  return new Interface(JSON.parse(json));
}

async function abiDoBackend() {
  const { FLIGHT_CONTRACT_ABI } = await import(
    "../backend/src/services/flightContractService.js"
  );
  return new Interface(FLIGHT_CONTRACT_ABI);
}

/**
 * Chave de comparacao de um fragmento.
 *
 * Os nomes dos parametros de retorno no nivel de cima sao descartados: o ABI
 * legivel do backend ("returns (bool,string)") nunca os traz, e eles nao
 * mudam a decodificacao. Ja os nomes dos campos de tuplas (as structs Voo e
 * Inscricao) sao mantidos, porque e por eles que o frontend le o resultado
 * (`voo.horarioPartida`, `inscricao.registrado`).
 */
function chave(fragmento) {
  const json = JSON.parse(fragmento.format("json"));

  for (const saida of json.outputs ?? []) {
    saida.name = "";
  }

  // `indexed: false` e omitido no ABI legivel e explicito no JSON do artefato.
  if (json.type === "event") {
    for (const entrada of json.inputs ?? []) {
      entrada.indexed = Boolean(entrada.indexed);
    }
  }

  return canonico(json);
}

// As duas origens de ABI (JSON do artefato e strings legiveis) produzem os
// mesmos campos em ordens diferentes; a comparacao precisa ser estavel.
function canonico(valor) {
  if (Array.isArray(valor)) {
    return `[${valor.map(canonico).join(",")}]`;
  }

  if (valor && typeof valor === "object") {
    return `{${Object.keys(valor)
      .sort()
      .map((chaveDoCampo) => `${chaveDoCampo}:${canonico(valor[chaveDoCampo])}`)
      .join(",")}}`;
  }

  return JSON.stringify(valor);
}

function fragmentos(iface) {
  return new Map(iface.fragments.map((fragmento) => [chave(fragmento), fragmento.format("full")]));
}

function conferir(nome, iface, contrato, { exigirCompleto }) {
  const doContrato = fragmentos(contrato);
  const daCopia = fragmentos(iface);
  const problemas = [];

  for (const [assinatura, legivel] of daCopia) {
    if (!doContrato.has(assinatura)) {
      problemas.push(`  - nao existe (ou mudou de assinatura) no contrato: ${legivel}`);
    }
  }

  if (exigirCompleto) {
    for (const [assinatura, legivel] of doContrato) {
      if (!daCopia.has(assinatura)) {
        problemas.push(`  - falta no ${nome}: ${legivel}`);
      }
    }
  }

  if (problemas.length > 0) {
    console.error(`ABI do ${nome} divergente do contrato compilado:`);
    console.error(problemas.join("\n"));
    return false;
  }

  console.log(
    `ABI do ${nome}: ${daCopia.size} fragmentos conferem com o contrato compilado.`
  );
  return true;
}

async function main() {
  const contrato = await abiDoContrato();

  // O frontend mantem o ABI completo (usa leituras diretas via RPC); o
  // backend so precisa do subconjunto que ele assina/le.
  const okFrontend = conferir("frontend", await abiDoFrontend(), contrato, {
    exigirCompleto: true
  });
  const okBackend = conferir("backend", await abiDoBackend(), contrato, {
    exigirCompleto: false
  });

  if (!okFrontend || !okBackend) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
