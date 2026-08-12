import { VOOS_MOCK, buscarVoo, paraTimestamp } from "../../../oracle/voos.mock.js";
import { hashCpf, cpfValido, mascararCpf, normalizarCpf } from "../../../lib/cpf.js";
import { brl, duracao } from "../../../lib/formato.js";
import { conflito, erroDeUso, naoEncontrado, traduzirErroDeContrato } from "../erros.js";

/**
 * Painel da companhia aérea.
 *
 * A companhia cadastra o voo, embarca o passageiro e deposita a garantia no
 * mesmo ato — é o "depósito prévio em conta de garantia" da proposta. A
 * partir daí ela não decide mais nada: quem apura o voo é o oráculo, e o
 * destino do dinheiro sai da regra registrada no contrato.
 */
export function criarServicoDaCompanhia({ acesso, consultas, manifesto }) {
  const contrato = acesso.leitura;

  async function valorDaGarantia() {
    return contrato.VALOR_INDENIZACAO();
  }

  /** Voos da base do oráculo, marcando os que já estão na cadeia. */
  async function voosDisponiveis() {
    const ids = await contrato.listarVoosDaCompanhia(acesso.enderecoDaCompanhia);
    const cadastrados = new Set();

    for (const id of ids) {
      const voo = await contrato.consultarVoo(id);
      cadastrados.add(voo.codigo);
    }

    return VOOS_MOCK.map((voo) => ({
      codigo: voo.codigo,
      operadora: voo.companhia,
      origem: voo.origem,
      destino: voo.destino,
      partidaPrevista: paraTimestamp(voo.partidaPrevista),
      chegadaPrevista: paraTimestamp(voo.chegadaPrevista),
      cadastrado: cadastrados.has(voo.codigo)
    }));
  }

  async function cadastrarVoo(codigo) {
    const dados = buscarVoo(codigo);
    if (!dados) {
      throw naoEncontrado(`Voo ${codigo} nao existe na base do oraculo`);
    }

    const vooId = await contrato.idDoVoo(dados.codigo);
    const jaExiste = await contrato
      .consultarVoo(vooId)
      .then(() => true)
      .catch(() => false);

    if (jaExiste) {
      throw conflito(`Voo ${dados.codigo} ja esta cadastrado na blockchain`);
    }

    try {
      const transacao = await acesso.comoCompanhia.cadastrarVoo(
        dados.codigo,
        paraTimestamp(dados.partidaPrevista),
        paraTimestamp(dados.chegadaPrevista)
      );
      const recibo = await transacao.wait();

      return { codigo: dados.codigo, vooId, txHash: recibo.hash, bloco: recibo.blockNumber };
    } catch (erro) {
      throw traduzirErroDeContrato(erro);
    }
  }

  /**
   * Embarca um passageiro e trava a garantia no escrow.
   *
   * Se o voo ainda não estiver na cadeia, ele é cadastrado antes — a
   * companhia não precisa fazer as duas coisas em telas separadas.
   */
  async function embarcarPassageiro({ codigo, nome, cpf }) {
    const dados = buscarVoo(codigo);
    if (!dados) {
      throw naoEncontrado(`Voo ${codigo} nao existe na base do oraculo`);
    }

    if (!String(nome ?? "").trim()) {
      throw erroDeUso("Informe o nome do passageiro");
    }

    if (!cpfValido(cpf)) {
      throw erroDeUso("CPF invalido");
    }

    if (await manifesto.existe(dados.codigo, cpf)) {
      throw conflito(`Passageiro ${mascararCpf(cpf)} ja esta embarcado no voo ${dados.codigo}`);
    }

    const vooId = await contrato.idDoVoo(dados.codigo);
    const voo = await contrato.consultarVoo(vooId).catch(() => null);

    if (!voo) {
      await cadastrarVoo(dados.codigo);
    } else if (Number(voo.status) !== 0) {
      throw conflito(
        `Voo ${dados.codigo} ja foi apurado pelo oraculo e nao aceita novos passageiros`
      );
    }

    const garantia = await valorDaGarantia();

    try {
      const transacao = await acesso.comoCompanhia.registrarBilhete(dados.codigo, hashCpf(cpf), {
        value: garantia
      });
      const recibo = await transacao.wait();

      const bilheteId = await contrato.idDoBilhete(dados.codigo, hashCpf(cpf));
      const registro = await manifesto.registrar({
        codigoVoo: dados.codigo,
        nome,
        cpf,
        bilheteId
      });

      return {
        bilheteId,
        codigo: dados.codigo,
        passageiro: registro.nome,
        cpf: mascararCpf(cpf),
        garantia: brl(garantia),
        txHash: recibo.hash,
        bloco: recibo.blockNumber
      };
    } catch (erro) {
      throw traduzirErroDeContrato(erro);
    }
  }

  /** Saca as garantias já devolvidas por voos pontuais. */
  async function resgatarGarantias(valorWei = null) {
    const disponivel = await contrato.saldoLiberado(acesso.enderecoDaCompanhia);
    const valor = valorWei ? BigInt(valorWei) : disponivel;

    if (disponivel === 0n) {
      throw erroDeUso("Nenhuma garantia liberada para resgate");
    }

    if (valor > disponivel) {
      throw erroDeUso(`Valor acima do saldo liberado (${brl(disponivel)})`);
    }

    try {
      const transacao = await acesso.comoCompanhia.resgatarGarantias(valor);
      const recibo = await transacao.wait();

      return { valor: brl(valor), txHash: recibo.hash, bloco: recibo.blockNumber };
    } catch (erro) {
      throw traduzirErroDeContrato(erro);
    }
  }

  async function painel() {
    const ids = await contrato.listarVoosDaCompanhia(acesso.enderecoDaCompanhia);
    const voos = await consultas.listarVoos(ids);

    const saldoLiberado = await contrato.saldoLiberado(acesso.enderecoDaCompanhia);
    const emEscrow = voos
      .flatMap((voo) => voo.bilhetes)
      .filter((bilhete) => bilhete.status === "Ativo")
      .reduce((total, bilhete) => total + BigInt(bilhete.garantiaWei), 0n);

    const indenizados = voos
      .flatMap((voo) => voo.bilhetes)
      .filter((bilhete) => bilhete.indenizado);

    return {
      regra: await consultas.regra(),
      carteira: acesso.enderecoDaCompanhia,
      contrato: acesso.endereco,
      totais: {
        voos: voos.length,
        aguardandoOraculo: voos.filter((voo) => !voo.apurado).length,
        pontuais: voos.filter((voo) => voo.apurado && !voo.atrasado).length,
        atrasados: voos.filter((voo) => voo.atrasado).length,
        passageiros: voos.reduce((total, voo) => total + voo.totalBilhetes, 0),
        indenizacoesPagas: indenizados.length,
        totalIndenizado: brl(
          indenizados.reduce((total, bilhete) => total + BigInt(bilhete.garantiaWei), 0n)
        ),
        emEscrow: brl(emEscrow),
        saldoLiberado: brl(saldoLiberado),
        saldoLiberadoWei: saldoLiberado.toString()
      },
      voos
    };
  }

  return {
    voosDisponiveis,
    cadastrarVoo,
    embarcarPassageiro,
    resgatarGarantias,
    painel,

    /** Resumo textual do voo, usado nas mensagens de retorno da API. */
    descrever(codigo) {
      const dados = buscarVoo(codigo);
      if (!dados) return codigo;
      const atraso = paraTimestamp(dados.chegadaReal) - paraTimestamp(dados.chegadaPrevista);
      return `${dados.codigo} ${dados.origem}→${dados.destino} (${duracao(Math.max(0, atraso) / 60)})`;
    },

    normalizarCpf
  };
}
