import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

/**
 * Configuração do backend.
 *
 * O endereço do contrato e os endereços dos papéis não são digitados em
 * lugar nenhum: vêm de `rede/<rede>.json`, gravado pelo próprio script de
 * deploy. O ABI vem direto de `artifacts/`, o que dispensa manter
 * uma cópia à mão e elimina a chance de ela ficar defasada em relação ao
 * contrato compilado.
 */

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const CAMINHO_ABI = path.join(RAIZ, "artifacts", "contracts", "SeguroVoo.sol", "SeguroVoo.json");

function lerRegistroDaImplantacao(rede) {
  const arquivo = path.join(RAIZ, "rede", `${rede}.json`);

  if (!existsSync(arquivo)) {
    throw new Error(
      `Implantacao nao encontrada em rede/${rede}.json.\n` +
        `Suba a rede com "npm run chain" e implante com "npm run deploy".`
    );
  }

  return JSON.parse(readFileSync(arquivo, "utf8"));
}

function lerAbi() {
  if (!existsSync(CAMINHO_ABI)) {
    throw new Error('Contrato nao compilado. Rode "npm run compile".');
  }

  return JSON.parse(readFileSync(CAMINHO_ABI, "utf8")).abi;
}

function inteiro(valor, padrao) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : padrao;
}

export function carregarConfig(ajustes = {}) {
  const rede = ajustes.rede ?? process.env.REDE ?? "localhost";
  const registro = lerRegistroDaImplantacao(rede);

  return {
    rede,
    chainId: registro.chainId,
    rpcUrl: ajustes.rpcUrl ?? process.env.RPC_URL ?? registro.rpcUrl ?? "http://127.0.0.1:8545",
    contrato: registro.endereco,
    papeis: registro.papeis,
    usuariosDeTeste: registro.usuariosDeTeste ?? [],
    abi: lerAbi(),

    host: ajustes.host ?? process.env.HOST ?? "127.0.0.1",
    // 3001 por padrão: o frontend (Vite) já ocupa a 3000.
    porta: inteiro(ajustes.porta ?? process.env.PORT, 3001),

    // Dados pessoais (nome, CPF) vivem só aqui, fora da blockchain.
    arquivoClientes:
      ajustes.arquivoClientes ??
      process.env.ARQUIVO_CLIENTES ??
      path.join(RAIZ, "data", "clientes.json"),
    arquivoManifesto:
      ajustes.arquivoManifesto ??
      process.env.ARQUIVO_MANIFESTO ??
      path.join(RAIZ, "data", "manifesto.json"),

    // Espera entre o cadastro do voo e a apuração pelo oráculo. É a janela
    // que a companhia tem para embarcar os passageiros: assim que o voo é
    // apurado, o contrato deixa de aceitar novos bilhetes nele.
    esperaApuracaoSegundos: inteiro(process.env.ESPERA_APURACAO_SEGUNDOS, 7),

    // Rede de segurança do oráculo: cada voo já é apurado por um disparo
    // agendado no instante do cadastro, e esta varredura só recolhe o que
    // tiver sobrado de uma execução anterior.
    intervaloOraculoSegundos: inteiro(process.env.INTERVALO_ORACULO_SEGUNDOS, 5),

    servirFrontend:
      ajustes.servirFrontend ??
      (process.env.SERVIR_FRONTEND
        ? process.env.SERVIR_FRONTEND === "true"
        : existsSync(path.join(RAIZ, "frontend", "dist", "index.html"))),
    pastaFrontend: path.join(RAIZ, "frontend", "dist")
  };
}
