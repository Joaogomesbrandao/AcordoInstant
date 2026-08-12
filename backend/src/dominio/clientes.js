import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { hashCpf, normalizarCpf } from "../../../lib/cpf.js";

/**
 * Cadastro dos clientes — a única parte do sistema que guarda dado pessoal.
 *
 * Nome e CPF em claro ficam aqui, fora da blockchain. Para a cadeia só vai
 * `hashCpf`, e é por ele que o contrato reserva e deposita a indenização.
 * Essa separação é o que permite atender à LGPD sem abrir mão do CPF como
 * identificador único do cliente.
 */
export class RepositorioClientes {
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

  async buscarPorCpf(cpf) {
    const digitos = normalizarCpf(cpf);
    const clientes = await this.#carregar();
    return clientes.find((cliente) => cliente.cpf === digitos) ?? null;
  }

  async buscarPorCarteira(carteira) {
    const alvo = String(carteira ?? "").toLowerCase();
    const clientes = await this.#carregar();
    return clientes.find((cliente) => cliente.carteira.toLowerCase() === alvo) ?? null;
  }

  async criar({ nome, cpf, carteira }) {
    const digitos = normalizarCpf(cpf);
    const clientes = await this.#carregar();

    const cliente = {
      nome: String(nome).trim(),
      cpf: digitos,
      hashCpf: hashCpf(digitos),
      carteira,
      criadoEm: new Date().toISOString()
    };

    clientes.push(cliente);
    await this.#persistir();

    return cliente;
  }
}
