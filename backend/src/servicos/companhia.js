import { VOOS_MOCK, atrasoMinutos, buscarVoo, paraTimestamp } from "../../../oracle/voos.mock.js";
import { hashCpf, cpfValido, mascararCpf, normalizarCpf } from "../../../lib/cpf.js";
import { brl, duracao, eth } from "../../../lib/formato.js";
import { conflito, erroDeUso, naoEncontrado, traduzirErroDeContrato } from "../erros.js";

/**
 * Painel da companhia aérea.
 *
 * A companhia cadastra o voo, embarca o passageiro e deposita a garantia no
 * mesmo ato, que é o "depósito prévio em conta de garantia" da proposta. A
 * partir daí ela não decide mais nada: quem apura o voo é o oráculo, e o
 * destino do dinheiro sai da regra registrada no contrato.
 */
export function criarServicoDaCompanhia({ acesso, consultas, manifesto }) {
  const contrato = acesso.leitura;

  async function valorDaGarantia() {
    return contrato.VALOR_INDENIZACAO();
  }

  /**
   * Voos da base do oráculo, marcando os que já estão na cadeia.
   *
   * O desfecho de cada voo (atraso apurado e se ele passa do limite) vem
   * junto porque a base do oráculo já contém o horário real. Isso deixa a
   * seleção do voo explícita na hora de apresentar o sistema: dá para
   * escolher de propósito um voo que vai indenizar ou um que não vai.
   */
  async function voosDisponiveis() {
    const ids = await contrato.listarVoosDaCompanhia(acesso.enderecoDaCompanhia);
    const cadastrados = new Set();

    for (const id of ids) {
      const voo = await contrato.consultarVoo(id);
      cadastrados.add(voo.codigo);
    }

    const limiteMinutos = Number(await contrato.LIMIAR_ATRASO_HORAS()) * 60;

    return VOOS_MOCK.map((voo) => {
      const minutos = atrasoMinutos(voo);

      return {
        codigo: voo.codigo,
        operadora: voo.companhia,
        origem: voo.origem,
        destino: voo.destino,
        partidaPrevista: paraTimestamp(voo.partidaPrevista),
        chegadaPrevista: paraTimestamp(voo.chegadaPrevista),
        cadastrado: cadastrados.has(voo.codigo),
        atrasoMinutos: minutos,
        atraso: duracao(minutos),
        /** true quando o atraso passa do limite e o voo vai indenizar. */
        indeniza: minutos > limiteMinutos
      };
    });
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
   * Embarca uma lista de passageiros no mesmo voo, travando uma garantia
   * por bilhete.
   *
   * A lista inteira é validada antes de qualquer transação sair. Sem isso,
   * um CPF inválido no meio da lista deixaria o voo com metade dos
   * passageiros embarcados e metade recusados, depois de o dinheiro dos
   * primeiros já ter sido depositado.
   *
   * Se o voo ainda não estiver na cadeia, ele é cadastrado antes, para a
   * companhia não precisar fazer as duas coisas em telas separadas.
   */
  async function embarcarPassageiros({ codigo, passageiros }) {
    const dados = buscarVoo(codigo);
    if (!dados) {
      throw naoEncontrado(`Voo ${codigo} nao existe na base do oraculo`);
    }

    const lista = Array.isArray(passageiros) ? passageiros : [];
    if (lista.length === 0) {
      throw erroDeUso("Adicione ao menos um passageiro antes de confirmar");
    }

    const vistos = new Set();

    for (const passageiro of lista) {
      if (!String(passageiro?.nome ?? "").trim()) {
        throw erroDeUso("Informe o nome de todos os passageiros");
      }

      if (!cpfValido(passageiro?.cpf)) {
        throw erroDeUso(`CPF invalido: ${passageiro?.cpf ?? ""}`);
      }

      const digitos = normalizarCpf(passageiro.cpf);

      if (vistos.has(digitos)) {
        throw conflito(`CPF ${mascararCpf(digitos)} aparece duas vezes na lista`);
      }
      vistos.add(digitos);

      if (await manifesto.existe(dados.codigo, digitos)) {
        throw conflito(
          `Passageiro ${mascararCpf(digitos)} ja esta embarcado no voo ${dados.codigo}`
        );
      }
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
    const embarcados = [];

    for (const passageiro of lista) {
      const hash = hashCpf(passageiro.cpf);

      try {
        const transacao = await acesso.comoCompanhia.registrarBilhete(dados.codigo, hash, {
          value: garantia
        });
        const recibo = await transacao.wait();

        const bilheteId = await contrato.idDoBilhete(dados.codigo, hash);
        const registro = await manifesto.registrar({
          codigoVoo: dados.codigo,
          nome: passageiro.nome,
          cpf: passageiro.cpf,
          bilheteId
        });

        embarcados.push({
          bilheteId,
          passageiro: registro.nome,
          cpf: mascararCpf(passageiro.cpf),
          txHash: recibo.hash,
          bloco: recibo.blockNumber
        });
      } catch (erro) {
        throw traduzirErroDeContrato(erro);
      }
    }

    return {
      codigo: dados.codigo,
      embarcados,
      total: embarcados.length,
      garantiaPorBilhete: brl(garantia),
      garantiaTotal: brl(garantia * BigInt(embarcados.length))
    };
  }

  /** Atalho de um passageiro só, usado pelos dados de demonstração. */
  async function embarcarPassageiro({ codigo, nome, cpf }) {
    const resultado = await embarcarPassageiros({ codigo, passageiros: [{ nome, cpf }] });

    return {
      ...resultado.embarcados[0],
      codigo: resultado.codigo,
      garantia: resultado.garantiaPorBilhete
    };
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
    const saldoCarteira = await acesso.provedor.getBalance(acesso.enderecoDaCompanhia);
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
        saldoLiberadoWei: saldoLiberado.toString(),
        // Saldo da carteira da companhia, fora do contrato: é de onde saem
        // as garantias e para onde voltam os resgates.
        saldoCarteira: eth(saldoCarteira),
        saldoCarteiraReais: brl(saldoCarteira)
      },
      voos
    };
  }

  return {
    voosDisponiveis,
    cadastrarVoo,
    embarcarPassageiro,
    embarcarPassageiros,
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
