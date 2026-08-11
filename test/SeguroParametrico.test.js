import assert from "node:assert/strict";
import { expect } from "chai";
import { network } from "hardhat";

/**
 * Testes do unico contrato do projeto, rodando na Hardhat Network em memoria.
 *
 * Cada bloco cobre uma das exigencias do projeto: escrow (fundo depositado
 * previamente pela companhia), logica parametrica (atraso > limiar =>
 * transferencia fixa), quitacao registrada em evento e as travas de acesso
 * que garantem que so a companhia dona do voo movimenta o fundo.
 */
describe("SeguroParametrico", function () {
  const VOO_ID = 1234n;
  const PARTIDA = 1893456000n; // 2030-01-01T00:00:00Z
  const CHEGADA = 1893463200n; // 2030-01-01T02:00:00Z
  const MULTA = 10_000_000_000_000_000n; // 0.01 ether

  let ethers;
  let contrato;
  let companhia;
  let outraCompanhia;
  let passageiro;

  before(async function () {
    ({ ethers } = await network.getOrCreate());
  });

  beforeEach(async function () {
    [companhia, outraCompanhia, passageiro] = await ethers.getSigners();
    const fabrica = await ethers.getContractFactory("SeguroParametrico");
    contrato = await fabrica.deploy();
    await contrato.waitForDeployment();
  });

  async function cadastrarVooPadrao() {
    await contrato.connect(companhia).cadastrarVoo(VOO_ID, PARTIDA, CHEGADA);
  }

  async function inscreverPassageiroPadrao() {
    await contrato
      .connect(companhia)
      .inscreverPassageiroPelaEmpresa(VOO_ID, passageiro.address);
  }

  describe("parametros publicos", function () {
    it("expoe o limiar e o valor da indenizacao", async function () {
      assert.equal(await contrato.LIMIAR_ATRASO_HORAS(), 2n);
      assert.equal(await contrato.VALOR_MULTA(), MULTA);
    });

    it("calcularMulta so paga acima de duas horas", async function () {
      assert.equal(await contrato.calcularMulta(0), 0n);
      assert.equal(await contrato.calcularMulta(2), 0n);
      assert.equal(await contrato.calcularMulta(3), MULTA);
      assert.equal(await contrato.calcularMulta(10), MULTA);
    });
  });

  describe("escrow da companhia", function () {
    it("credita o deposito no saldo da propria companhia", async function () {
      await expect(
        contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("1") })
      )
        .to.emit(contrato, "FundoDepositado")
        .withArgs(companhia.address, ethers.parseEther("1"), ethers.parseEther("1"));

      assert.equal(
        await contrato.consultarSaldo(companhia.address),
        ethers.parseEther("1")
      );
      assert.equal(await contrato.consultarSaldo(outraCompanhia.address), 0n);
    });

    it("recusa deposito de valor zero", async function () {
      await expect(
        contrato.connect(companhia).depositarFundo({ value: 0 })
      ).to.be.revertedWith("Informe um valor");
    });

    it("permite resgatar o saldo nao comprometido", async function () {
      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("1") });

      await expect(contrato.connect(companhia).resgatarFundo(ethers.parseEther("0.4")))
        .to.emit(contrato, "FundoResgatado")
        .withArgs(companhia.address, ethers.parseEther("0.4"), ethers.parseEther("0.6"));

      assert.equal(
        await contrato.consultarSaldo(companhia.address),
        ethers.parseEther("0.6")
      );
    });

    it("impede resgatar mais do que o proprio saldo", async function () {
      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("0.1") });

      await expect(
        contrato.connect(companhia).resgatarFundo(ethers.parseEther("0.2"))
      ).to.be.revertedWith("Saldo insuficiente");

      // O fundo de uma companhia nao pode ser sacado por outra.
      await expect(
        contrato.connect(outraCompanhia).resgatarFundo(ethers.parseEther("0.1"))
      ).to.be.revertedWith("Saldo insuficiente");
    });
  });

  describe("cadastro de voo", function () {
    it("usa msg.sender como companhia do voo", async function () {
      await expect(contrato.connect(companhia).cadastrarVoo(VOO_ID, PARTIDA, CHEGADA))
        .to.emit(contrato, "VooCadastrado")
        .withArgs(VOO_ID, companhia.address, PARTIDA, CHEGADA);

      const voo = await contrato.consultarVoo(VOO_ID);
      assert.equal(voo.id, VOO_ID);
      assert.equal(voo.empresa, companhia.address);
      assert.equal(voo.horarioPartida, PARTIDA);
      assert.equal(voo.horarioChegada, CHEGADA);
      assert.equal(voo.totalPassageiros, 0n);

      assert.deepEqual(
        Array.from(await contrato.listarVoosDaEmpresa(companhia.address)),
        [VOO_ID]
      );
    });

    it("recusa numero de voo repetido", async function () {
      await cadastrarVooPadrao();
      await expect(
        contrato.connect(outraCompanhia).cadastrarVoo(VOO_ID, PARTIDA, CHEGADA)
      ).to.be.revertedWith("Voo ja cadastrado");
    });

    it("recusa chegada anterior ou igual a partida", async function () {
      await expect(
        contrato.connect(companhia).cadastrarVoo(VOO_ID, CHEGADA, PARTIDA)
      ).to.be.revertedWith("Horario de chegada deve ser posterior a partida");
    });

    it("consultarVoo reverte para voo inexistente", async function () {
      await expect(contrato.consultarVoo(999)).to.be.revertedWith("Voo nao cadastrado");
    });
  });

  describe("inscricao de passageiros", function () {
    beforeEach(cadastrarVooPadrao);

    it("a companhia inscreve o passageiro pelo endereco dele", async function () {
      await expect(
        contrato.connect(companhia).inscreverPassageiroPelaEmpresa(VOO_ID, passageiro.address)
      )
        .to.emit(contrato, "PassageiroInscritoPelaEmpresa")
        .withArgs(VOO_ID, companhia.address, passageiro.address);

      const inscricao = await contrato.consultarInscricao(VOO_ID, passageiro.address);
      assert.equal(inscricao.inscrito, true);
      assert.equal(inscricao.registrado, false);
      assert.equal(inscricao.pago, false);

      const voo = await contrato.consultarVoo(VOO_ID);
      assert.equal(voo.totalPassageiros, 1n);
      assert.deepEqual(
        Array.from(await contrato.listarVoosDoPassageiro(passageiro.address)),
        [VOO_ID]
      );
    });

    it("so a companhia dona do voo pode inscrever", async function () {
      await expect(
        contrato.connect(outraCompanhia).inscreverPassageiroPelaEmpresa(VOO_ID, passageiro.address)
      ).to.be.revertedWith("Somente a companhia do voo pode inscrever passageiros");
    });

    it("permite a autoinscricao do passageiro", async function () {
      await expect(contrato.connect(passageiro).inscreverNoVoo(VOO_ID))
        .to.emit(contrato, "PassageiroInscrito")
        .withArgs(VOO_ID, passageiro.address);
    });

    it("recusa inscricao duplicada e voo inexistente", async function () {
      await inscreverPassageiroPadrao();

      await expect(
        contrato.connect(companhia).inscreverPassageiroPelaEmpresa(VOO_ID, passageiro.address)
      ).to.be.revertedWith("Passageiro ja inscrito neste voo");

      await expect(
        contrato.connect(companhia).inscreverPassageiroPelaEmpresa(999, passageiro.address)
      ).to.be.revertedWith("Voo nao cadastrado");
    });
  });

  describe("registro de atraso e quitacao", function () {
    beforeEach(async function () {
      await cadastrarVooPadrao();
      await inscreverPassageiroPadrao();
    });

    it("paga o passageiro quando o atraso oficial supera o limiar", async function () {
      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("1") });
      const saldoAntes = await ethers.provider.getBalance(passageiro.address);

      const tx = await contrato
        .connect(companhia)
        .registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 3, 4);

      // O passageiro e sempre o beneficiario nos eventos, mesmo com a
      // transacao assinada pela companhia.
      await expect(tx)
        .to.emit(contrato, "AtrasoRegistrado")
        .withArgs(VOO_ID, passageiro.address, 3n, 4n);
      await expect(tx)
        .to.emit(contrato, "PagamentoRealizado")
        .withArgs(VOO_ID, companhia.address, passageiro.address, MULTA);
      await expect(tx).to.emit(contrato, "QuitacaoEmitida");

      const saldoDepois = await ethers.provider.getBalance(passageiro.address);
      assert.equal(saldoDepois - saldoAntes, MULTA);

      assert.equal(
        await contrato.consultarSaldo(companhia.address),
        ethers.parseEther("1") - MULTA
      );

      const inscricao = await contrato.consultarInscricao(VOO_ID, passageiro.address);
      assert.equal(inscricao.pago, true);
      assert.equal(inscricao.registrado, true);
      assert.equal(inscricao.atrasoHorasInformado, 3n);
      assert.equal(inscricao.atrasoHorasOficial, 4n);
    });

    it("registra sem pagar quando o atraso fica dentro do limite", async function () {
      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("1") });

      await expect(
        contrato.connect(companhia).registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 5, 1)
      )
        .to.emit(contrato, "PagamentoNaoRealizado")
        .withArgs(VOO_ID, passageiro.address, "Atraso abaixo do limite de indenizacao");

      const inscricao = await contrato.consultarInscricao(VOO_ID, passageiro.address);
      assert.equal(inscricao.pago, false);
      // Mesmo sem pagamento, a solicitacao fica marcada — e isso que a
      // interface usa para nao oferecer "Indicar atraso" de novo.
      assert.equal(inscricao.registrado, true);
      assert.equal(
        await contrato.consultarSaldo(companhia.address),
        ethers.parseEther("1")
      );
    });

    it("registra sem pagar quando falta fundo e paga na retentativa", async function () {
      await expect(
        contrato.connect(companhia).registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 4, 4)
      )
        .to.emit(contrato, "PagamentoNaoRealizado")
        .withArgs(VOO_ID, passageiro.address, "Companhia sem fundo suficiente");

      assert.equal(
        (await contrato.consultarInscricao(VOO_ID, passageiro.address)).pago,
        false
      );

      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("0.05") });

      await expect(
        contrato.connect(companhia).registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 4, 4)
      ).to.emit(contrato, "PagamentoRealizado");

      assert.equal(
        (await contrato.consultarInscricao(VOO_ID, passageiro.address)).pago,
        true
      );
    });

    it("nao paga duas vezes o mesmo passageiro", async function () {
      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("1") });
      await contrato
        .connect(companhia)
        .registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 4, 4);

      await expect(
        contrato.connect(companhia).registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 4, 4)
      ).to.be.revertedWith("Indenizacao ja paga para este passageiro");
    });

    it("recusa registro feito por quem nao e a companhia do voo", async function () {
      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("1") });

      await expect(
        contrato
          .connect(outraCompanhia)
          .registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 4, 4)
      ).to.be.revertedWith("Somente a companhia do voo pode registrar o atraso");

      // O proprio beneficiario tambem nao consegue disparar o pagamento:
      // nao existe funcao publica que aceite o atraso oficial vindo dele.
      await expect(
        contrato
          .connect(passageiro)
          .registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 4, 99)
      ).to.be.revertedWith("Somente a companhia do voo pode registrar o atraso");
    });

    it("recusa registro para passageiro nao inscrito", async function () {
      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("1") });

      await expect(
        contrato
          .connect(companhia)
          .registrarAtrasoPelaEmpresa(VOO_ID, outraCompanhia.address, 4, 4)
      ).to.be.revertedWith("Passageiro nao inscrito neste voo");
    });

    it("mantem as inscricoes independentes entre passageiros do mesmo voo", async function () {
      await contrato.connect(companhia).depositarFundo({ value: ethers.parseEther("1") });
      await contrato
        .connect(companhia)
        .inscreverPassageiroPelaEmpresa(VOO_ID, outraCompanhia.address);

      await contrato
        .connect(companhia)
        .registrarAtrasoPelaEmpresa(VOO_ID, passageiro.address, 4, 4);

      assert.equal(
        (await contrato.consultarInscricao(VOO_ID, passageiro.address)).pago,
        true
      );
      const outra = await contrato.consultarInscricao(VOO_ID, outraCompanhia.address);
      assert.equal(outra.pago, false);
      assert.equal(outra.registrado, false);
      assert.equal((await contrato.consultarVoo(VOO_ID)).totalPassageiros, 2n);
    });
  });
});
