import { getAddress, isAddress } from "ethers";

import { cpfValido, formatarCpf, hashCpf, normalizarCpf } from "../../../lib/cpf.js";
import { brl } from "../../../lib/formato.js";
import { conflito, erroDeUso, naoEncontrado, traduzirErroDeContrato } from "../erros.js";

/**
 * Cadastro e painel do cliente.
 *
 * O cliente informa apenas a chave pública: ele não assina transação
 * nenhuma e não tem botão de saque. A indenização é depositada direto na
 * carteira dele quando o oráculo apura o voo.
 *
 * Quando o voo atrasa antes de o cliente existir no sistema, o contrato
 * guarda o valor em nome do hash do CPF. O cadastro é o gatilho que libera
 * esse valor: ao vincular a carteira, o contrato deposita na mesma
 * transação tudo o que já estava reservado.
 */
export function criarServicoDoCliente({ acesso, consultas, clientes }) {
  const contrato = acesso.leitura;

  function validarEntrada({ nome, cpf, carteira }) {
    if (!String(nome ?? "").trim()) {
      throw erroDeUso("Informe seu nome");
    }

    if (!cpfValido(cpf)) {
      throw erroDeUso("CPF invalido");
    }

    if (!isAddress(String(carteira ?? "").trim())) {
      throw erroDeUso("Chave publica invalida (esperado 0x + 40 caracteres hexadecimais)");
    }
  }

  async function cadastrar({ nome, cpf, carteira }) {
    validarEntrada({ nome, cpf, carteira });

    const digitos = normalizarCpf(cpf);
    const endereco = getAddress(String(carteira).trim());

    if (await clientes.buscarPorCpf(digitos)) {
      throw conflito("Este CPF ja possui cadastro. Use a tela de entrar.");
    }

    const jaUsada = await clientes.buscarPorCarteira(endereco);
    if (jaUsada) {
      throw conflito("Esta carteira ja esta vinculada a outro CPF");
    }

    const hash = hashCpf(digitos);
    const vinculada = await contrato.carteiraDoCpf(hash);

    if (vinculada !== "0x0000000000000000000000000000000000000000") {
      if (vinculada.toLowerCase() !== endereco.toLowerCase()) {
        throw conflito("Este CPF ja esta vinculado a outra carteira na blockchain");
      }

      // O vínculo on-chain existe, mas o cadastro local não. Acontece
      // quando o estado off-chain é zerado com a rede no ar. Recriar o
      // registro é melhor do que deixar a pessoa sem acesso a um dinheiro
      // que o contrato já reconhece como dela.
      const recuperado = await clientes.criar({ nome, cpf: digitos, carteira: endereco });

      return {
        cliente: publico(recuperado),
        liberadoNoCadastro: brl(0n),
        liberadoNoCadastroWei: "0",
        txHash: null,
        bloco: null,
        recuperado: true
      };
    }

    // Quanto o contrato já guardava para este CPF antes do cadastro: é o
    // valor que a transação abaixo deposita de uma vez.
    const retidoAntes = await contrato.creditoRetido(hash);

    try {
      const transacao = await acesso.comoPlataforma.vincularCarteira(hash, endereco);
      const recibo = await transacao.wait();

      const cliente = await clientes.criar({ nome, cpf: digitos, carteira: endereco });

      return {
        cliente: publico(cliente),
        liberadoNoCadastro: brl(retidoAntes),
        liberadoNoCadastroWei: retidoAntes.toString(),
        txHash: recibo.hash,
        bloco: recibo.blockNumber
      };
    } catch (erro) {
      throw traduzirErroDeContrato(erro);
    }
  }

  async function entrar(cpf) {
    if (!cpfValido(cpf)) {
      throw erroDeUso("CPF invalido");
    }

    const cliente = await clientes.buscarPorCpf(cpf);
    if (!cliente) {
      throw naoEncontrado("CPF nao cadastrado. Crie sua conta para receber as indenizacoes.");
    }

    return publico(cliente);
  }

  async function painel(cpf) {
    const cliente = await clientes.buscarPorCpf(cpf);
    if (!cliente) {
      throw naoEncontrado("CPF nao cadastrado");
    }

    const hash = cliente.hashCpf;
    const [depositado, retido] = await contrato.resumoDoCpf(hash);

    const ids = await contrato.listarBilhetesDoCpf(hash);
    const viagens = [];

    for (const bilheteId of ids) {
      const bilhete = await contrato.consultarBilhete(bilheteId);
      const voo = await consultas.montarVoo(bilhete.vooId, { comBilhetes: false });
      const indenizado = Number(bilhete.status) === 1;

      viagens.push({
        bilheteId,
        voo,
        // Enquanto o oráculo não apura, o passageiro vê que o seguro está
        // ativo; depois, vê o desfecho e o valor que caiu na carteira.
        situacao: !voo.apurado
          ? "Seguro ativo · aguardando apuracao do oraculo"
          : indenizado
            ? "Indenizacao depositada"
            : "Voo dentro do prazo · sem indenizacao",
        indenizado,
        valorRecebido: indenizado ? brl(bilhete.garantia) : brl(0n),
        valorRecebidoWei: indenizado ? bilhete.garantia.toString() : "0",
        quitadoEm: Number(bilhete.quitadoEm) || null
      });
    }

    return {
      cliente: publico(cliente),
      regra: await consultas.regra(),
      totais: {
        depositado: brl(depositado),
        depositadoWei: depositado.toString(),
        // Só aparece se algo tiver sido apurado entre o cadastro e agora
        // sem carteira vinculada. Na prática, sempre zero após o cadastro.
        aguardandoCadastro: brl(retido),
        viagens: viagens.length,
        indenizadas: viagens.filter((viagem) => viagem.indenizado).length
      },
      viagens: viagens.reverse()
    };
  }

  function publico(cliente) {
    return {
      nome: cliente.nome,
      cpf: formatarCpf(cliente.cpf),
      cpfDigitos: cliente.cpf,
      carteira: cliente.carteira,
      hashCpf: cliente.hashCpf,
      criadoEm: cliente.criadoEm
    };
  }

  return { cadastrar, entrar, painel };
}
