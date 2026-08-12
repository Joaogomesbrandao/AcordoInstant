import { formatarCpf, gerarCpf } from "../lib/cpf.js";
import { criarLogger } from "../lib/logger.js";

/**
 * Popula o sistema com uma operação de exemplo, via API do backend.
 *
 *     npm run dev     # em um terminal
 *     npm run seed    # em outro
 *
 * Embarca passageiros em voos com os três desfechos possíveis (atraso acima
 * do limite, atraso abaixo do limite e voo pontual) e **não** cadastra
 * nenhum cliente. Isso é proposital: é o cenário mais interessante da
 * solução — quando o voo atrasa, o contrato guarda a indenização em nome do
 * hash do CPF, e o valor só é depositado quando aquela pessoa se cadastra
 * informando a chave pública.
 *
 * Os CPFs impressos ao final são os que devem ser usados na tela de cadastro
 * do cliente para ver o depósito acontecer.
 */

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3001";
const log = criarLogger("deploy.log");

/** CPFs sintéticos e válidos: nenhum número de pessoa real é usado. */
const PASSAGEIROS = [
  { nome: "Ana Souza", cpf: gerarCpf("111444777") },
  { nome: "Bruno Lima", cpf: gerarCpf("222555888") },
  { nome: "Carla Nunes", cpf: gerarCpf("333666999") },
  { nome: "Diego Alves", cpf: gerarCpf("444777111") },
  { nome: "Elisa Rocha", cpf: gerarCpf("555888222") }
];

/** Voos escolhidos para cobrir os três desfechos da regra. */
const EMBARQUES = [
  { voo: "G31702", passageiros: [0, 1] }, // atraso 4h45 -> indeniza
  { voo: "AD5310", passageiros: [2] }, // atraso 5h35 -> indeniza
  { voo: "LA3890", passageiros: [3] }, // atraso 4h05 -> indeniza (borda)
  { voo: "LA4115", passageiros: [4] }, // atraso 3h45 -> nao indeniza (borda)
  { voo: "AD4021", passageiros: [0] }, // pontual -> garantia volta
  { voo: "G31420", passageiros: [1] } // pontual -> garantia volta
];

async function chamar(caminho, corpo) {
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo)
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro ?? `Falha em ${caminho}`);
  }

  return dados;
}

async function main() {
  log.secao("AcordoInstant · dados de demonstracao", `backend em ${BASE_URL}`);

  await fetch(`${BASE_URL}/health`).catch(() => {
    throw new Error(`Backend nao respondeu em ${BASE_URL}. Rode "npm run dev" antes.`);
  });

  for (const embarque of EMBARQUES) {
    for (const indice of embarque.passageiros) {
      const passageiro = PASSAGEIROS[indice];

      try {
        await chamar("/api/companhia/passageiros", {
          codigo: embarque.voo,
          nome: passageiro.nome,
          cpf: passageiro.cpf
        });
      } catch (erro) {
        log.aviso(`${embarque.voo} · ${passageiro.nome}: ${erro.message}`);
      }
    }
  }

  log.simples("");
  log.simples("  Passageiros embarcados (nenhum cadastrado no sistema ainda):");
  for (const passageiro of PASSAGEIROS) {
    log.simples(`    ${passageiro.nome.padEnd(14)} ${formatarCpf(passageiro.cpf)}`);
  }

  log.simples("");
  log.simples("  Use um desses CPFs na tela de cadastro do cliente, com uma das");
  log.simples("  carteiras de teste impressas pelo deploy, para ver a indenizacao");
  log.simples("  retida ser depositada no ato do cadastro.");
  log.simples("");
}

main().catch((erro) => {
  log.erro(erro.message);
  process.exitCode = 1;
});
