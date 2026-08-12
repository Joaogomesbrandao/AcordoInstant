import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { hashCpf, normalizarCpf } from "../../../lib/cpf.js";

/**
 * Manifesto de passageiros da companhia aérea — registro off-chain.
 *
 * A companhia sabe quem embarcou: nome e CPF fazem parte da operação dela.
 * Esses dados ficam aqui, no servidor. Para a blockchain vai apenas o
 * `hashCpf`, e é o manifesto que permite ao painel da companhia mostrar
 * "Ana Souza" onde a cadeia registrou `0x9f2c…a4e1`.
 *
 * O TJPB audita pela cadeia, não por este arquivo: o Tribunal enxerga o
 * contrato, o valor e a quitação sem precisar dos dados pessoais.
 */
export class Manifesto {
  constructor(arquivo) {
    this.arquivo = arquivo;
    this.cache = null;
  }

  async #carregar() {
    if (this.cache) return this.cache;

    if (!existsSync(this.arquivo)) {
      this.cache = [];
      return this.cache;
    }

    const conteudo = await readFile(this.arquivo, "utf8");
    this.cache = conteudo.trim() ? JSON.parse(conteudo) : [];
    return this.cache;
  }

  async #persistir() {
    await mkdir(path.dirname(this.arquivo), { recursive: true });
    await writeFile(this.arquivo, `${JSON.stringify(this.cache, null, 2)}\n`, "utf8");
  }

  async listar() {
    return [...(await this.#carregar())];
  }

  async registrar({ codigoVoo, nome, cpf, bilheteId }) {
    const digitos = normalizarCpf(cpf);
    const registros = await this.#carregar();

    const registro = {
      bilheteId,
      codigoVoo: String(codigoVoo).toUpperCase(),
      nome: String(nome).trim(),
      cpf: digitos,
      hashCpf: hashCpf(digitos),
      registradoEm: new Date().toISOString()
    };

    registros.push(registro);
    await this.#persistir();

    return registro;
  }

  async porVoo(codigoVoo) {
    const alvo = String(codigoVoo).toUpperCase();
    const registros = await this.#carregar();
    return registros.filter((registro) => registro.codigoVoo === alvo);
  }

  /** Índice `hashCpf -> {nome, cpf}`, usado para nomear os painéis. */
  async indicePorHash() {
    const registros = await this.#carregar();
    const indice = new Map();

    for (const registro of registros) {
      if (!indice.has(registro.hashCpf)) {
        indice.set(registro.hashCpf, { nome: registro.nome, cpf: registro.cpf });
      }
    }

    return indice;
  }

  async existe(codigoVoo, cpf) {
    const digitos = normalizarCpf(cpf);
    const doVoo = await this.porVoo(codigoVoo);
    return doVoo.some((registro) => registro.cpf === digitos);
  }
}
