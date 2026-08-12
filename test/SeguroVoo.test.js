import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";

import { hashCpf, gerarCpf } from "../lib/cpf.js";

/**
 * Testes do SeguroVoo.
 *
 * Cobrem o caminho central (embarque → apuração → pagamento) e, sobretudo,
 * o que a solução promete e não pode falhar: só o oráculo declara o atraso,
 * a regra é aplicada nos dois lados do limite, o passageiro recebe sem
 * assinar nada e o dinheiro de um CPF sem cadastro não se perde.
 */

const HORA = 3600;
const PARTIDA = 1_775_000_000;
const CHEGADA = PARTIDA + 3 * HORA;
const ZERO = "0x0000000000000000000000000000000000000000";

const CPF_ANA = gerarCpf("111444777");
const CPF_BRUNO = gerarCpf("222555888");

const StatusVoo = { Agendado: 0n, Pontual: 1n, Atrasado: 2n };
const StatusBilhete = { Ativo: 0n, Indenizado: 1n, GarantiaLiberada: 2n };

describe("SeguroVoo", () => {
  let ethers;
  let contrato;
  let garantia;
  let companhia;
  let oraculo;
  let tjpb;
  let plataforma;
  let passageiro;
  let intruso;

  beforeEach(async () => {
    ({ ethers } = await network.connect());
    [companhia, oraculo, tjpb, plataforma, passageiro, intruso] = await ethers.getSigners();

    contrato = await ethers.deployContract("SeguroVoo", [
      oraculo.address,
      tjpb.address,
      plataforma.address
    ]);

    garantia = await contrato.VALOR_INDENIZACAO();
  });

  /** Cadastra o voo e embarca um passageiro, devolvendo o id do bilhete. */
  async function embarcar(codigo, cpf, chegadaPrevista = CHEGADA) {
    const jaExiste = await contrato
      .consultarVoo(await contrato.idDoVoo(codigo))
      .then(() => true)
      .catch(() => false);

    if (!jaExiste) {
      await contrato.connect(companhia).cadastrarVoo(codigo, PARTIDA, chegadaPrevista);
    }

    await contrato.connect(companhia).registrarBilhete(codigo, hashCpf(cpf), { value: garantia });
    return contrato.idDoBilhete(codigo, hashCpf(cpf));
  }

  describe("termos do contrato", () => {
    it("publica a regra na cadeia: acima de 4 horas, R$ 500,00", async () => {
      const [limiar, valor, centavos] = await contrato.regraContrato();

      assert.equal(limiar, 4n);
      assert.equal(valor, ethers.parseEther("0.5"));
      assert.equal(centavos, 50_000n);
    });

    it("registra os tres papeis institucionais", async () => {
      assert.equal(await contrato.oraculo(), oraculo.address);
      assert.equal(await contrato.tjpb(), tjpb.address);
      assert.equal(await contrato.plataforma(), plataforma.address);
    });
  });

  describe("cadastro de voo e bilhete", () => {
    it("cadastra o voo com a companhia que assinou", async () => {
      await contrato.connect(companhia).cadastrarVoo("G31702", PARTIDA, CHEGADA);
      const voo = await contrato.consultarVoo(await contrato.idDoVoo("G31702"));

      assert.equal(voo.codigo, "G31702");
      assert.equal(voo.companhia, companhia.address);
      assert.equal(voo.status, StatusVoo.Agendado);
    });

    it("recusa chegada anterior a partida", async () => {
      await assert.rejects(
        contrato.connect(companhia).cadastrarVoo("X1", CHEGADA, PARTIDA),
        /Chegada deve ser depois da partida/
      );
    });

    it("recusa o mesmo voo duas vezes", async () => {
      await contrato.connect(companhia).cadastrarVoo("G31702", PARTIDA, CHEGADA);

      await assert.rejects(
        contrato.connect(companhia).cadastrarVoo("G31702", PARTIDA, CHEGADA),
        /Voo ja cadastrado/
      );
    });

    it("trava exatamente a indenizacao como garantia", async () => {
      const bilheteId = await embarcar("G31702", CPF_ANA);
      const bilhete = await contrato.consultarBilhete(bilheteId);

      assert.equal(bilhete.garantia, garantia);
      assert.equal(bilhete.status, StatusBilhete.Ativo);
      assert.equal(await ethers.provider.getBalance(await contrato.getAddress()), garantia);
    });

    it("recusa garantia de valor diferente da regra", async () => {
      await contrato.connect(companhia).cadastrarVoo("G31702", PARTIDA, CHEGADA);

      await assert.rejects(
        contrato
          .connect(companhia)
          .registrarBilhete("G31702", hashCpf(CPF_ANA), { value: garantia - 1n }),
        /Garantia deve ser igual a indenizacao/
      );
    });

    it("so a companhia dona do voo embarca passageiros", async () => {
      await contrato.connect(companhia).cadastrarVoo("G31702", PARTIDA, CHEGADA);

      await assert.rejects(
        contrato.connect(intruso).registrarBilhete("G31702", hashCpf(CPF_ANA), { value: garantia }),
        /Somente a companhia do voo/
      );
    });

    it("recusa o mesmo CPF duas vezes no mesmo voo", async () => {
      await embarcar("G31702", CPF_ANA);

      await assert.rejects(
        contrato
          .connect(companhia)
          .registrarBilhete("G31702", hashCpf(CPF_ANA), { value: garantia }),
        /Bilhete ja registrado/
      );
    });

    it("nao guarda o CPF em claro: o identificador e o hash", async () => {
      const bilheteId = await embarcar("G31702", CPF_ANA);
      const bilhete = await contrato.consultarBilhete(bilheteId);

      assert.equal(bilhete.hashCpf, hashCpf(CPF_ANA));
      assert.notEqual(bilhete.hashCpf, CPF_ANA);
    });
  });

  describe("apuracao pelo oraculo", () => {
    it("so o oraculo pode reportar a chegada", async () => {
      await embarcar("G31702", CPF_ANA);

      await assert.rejects(
        contrato.connect(companhia).reportarChegada("G31702", CHEGADA + 5 * HORA),
        /Somente o oraculo reporta o voo/
      );

      await assert.rejects(
        contrato.connect(passageiro).reportarChegada("G31702", CHEGADA + 5 * HORA),
        /Somente o oraculo reporta o voo/
      );
    });

    it("nao apura o mesmo voo duas vezes", async () => {
      await embarcar("G31702", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);

      await assert.rejects(
        contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 6 * HORA),
        /Voo ja apurado/
      );
    });

    it("recusa embarque depois da apuracao", async () => {
      await embarcar("G31702", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);

      await assert.rejects(
        contrato
          .connect(companhia)
          .registrarBilhete("G31702", hashCpf(CPF_BRUNO), { value: garantia }),
        /Voo ja apurado pelo oraculo/
      );
    });
  });

  describe("regra parametrica", () => {
    it("atraso de 4h05 indeniza, a comparacao e em minutos", async () => {
      const bilheteId = await embarcar("LA3890", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("LA3890", CHEGADA + 4 * HORA + 5 * 60);

      const voo = await contrato.consultarVoo(await contrato.idDoVoo("LA3890"));
      const bilhete = await contrato.consultarBilhete(bilheteId);

      assert.equal(voo.status, StatusVoo.Atrasado);
      assert.equal(voo.atrasoMinutos, 245n);
      assert.equal(bilhete.status, StatusBilhete.Indenizado);
    });

    it("atraso de exatamente 4h nao indeniza, a regra e 'superior a'", async () => {
      const bilheteId = await embarcar("LA4115", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("LA4115", CHEGADA + 4 * HORA);

      const voo = await contrato.consultarVoo(await contrato.idDoVoo("LA4115"));
      const bilhete = await contrato.consultarBilhete(bilheteId);

      assert.equal(voo.status, StatusVoo.Pontual);
      assert.equal(voo.atrasoMinutos, 240n);
      assert.equal(bilhete.status, StatusBilhete.GarantiaLiberada);
    });

    it("chegada adiantada nao gera atraso negativo", async () => {
      await embarcar("AD4021", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("AD4021", CHEGADA - 10 * 60);

      const voo = await contrato.consultarVoo(await contrato.idDoVoo("AD4021"));

      assert.equal(voo.atrasoMinutos, 0n);
      assert.equal(voo.status, StatusVoo.Pontual);
    });
  });

  describe("pagamento ao passageiro", () => {
    it("deposita direto na carteira quando o CPF ja esta vinculado", async () => {
      await contrato.connect(plataforma).vincularCarteira(hashCpf(CPF_ANA), passageiro.address);
      await embarcar("G31702", CPF_ANA);

      const antes = await ethers.provider.getBalance(passageiro.address);
      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);
      const depois = await ethers.provider.getBalance(passageiro.address);

      // O passageiro não assina nada: o saldo sobe sem ele gastar gás.
      assert.equal(depois - antes, garantia);
      assert.equal(await contrato.totalDepositado(hashCpf(CPF_ANA)), garantia);
    });

    it("retem o valor quando o CPF ainda nao tem carteira", async () => {
      await embarcar("G31702", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);

      assert.equal(await contrato.creditoRetido(hashCpf(CPF_ANA)), garantia);
      assert.equal(await contrato.carteiraDoCpf(hashCpf(CPF_ANA)), ZERO);
    });

    it("libera o retido no cadastro, sem nenhum saque", async () => {
      await embarcar("G31702", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);

      const antes = await ethers.provider.getBalance(passageiro.address);
      await contrato.connect(plataforma).vincularCarteira(hashCpf(CPF_ANA), passageiro.address);
      const depois = await ethers.provider.getBalance(passageiro.address);

      assert.equal(depois - antes, garantia);
      assert.equal(await contrato.creditoRetido(hashCpf(CPF_ANA)), 0n);
      assert.equal(await contrato.totalDepositado(hashCpf(CPF_ANA)), garantia);
    });

    it("acumula varios voos atrasados do mesmo CPF antes do cadastro", async () => {
      await embarcar("G31702", CPF_ANA);
      await embarcar("AD5310", CPF_ANA);

      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);
      await contrato.connect(oraculo).reportarChegada("AD5310", CHEGADA + 6 * HORA);

      assert.equal(await contrato.creditoRetido(hashCpf(CPF_ANA)), garantia * 2n);

      const antes = await ethers.provider.getBalance(passageiro.address);
      await contrato.connect(plataforma).vincularCarteira(hashCpf(CPF_ANA), passageiro.address);
      const depois = await ethers.provider.getBalance(passageiro.address);

      assert.equal(depois - antes, garantia * 2n);
    });

    it("paga todos os passageiros do voo na mesma transacao", async () => {
      await contrato.connect(plataforma).vincularCarteira(hashCpf(CPF_ANA), passageiro.address);
      await contrato.connect(plataforma).vincularCarteira(hashCpf(CPF_BRUNO), intruso.address);

      await embarcar("G31702", CPF_ANA);
      await embarcar("G31702", CPF_BRUNO);

      const antesAna = await ethers.provider.getBalance(passageiro.address);
      const antesBruno = await ethers.provider.getBalance(intruso.address);

      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);

      assert.equal((await ethers.provider.getBalance(passageiro.address)) - antesAna, garantia);
      assert.equal((await ethers.provider.getBalance(intruso.address)) - antesBruno, garantia);
    });

    it("emite o termo de quitacao com valor e atraso", async () => {
      await embarcar("G31702", CPF_ANA);
      const transacao = await contrato
        .connect(oraculo)
        .reportarChegada("G31702", CHEGADA + 5 * HORA);
      const recibo = await transacao.wait();

      const quitacoes = await contrato.queryFilter(
        contrato.filters.QuitacaoEmitida(),
        recibo.blockNumber,
        recibo.blockNumber
      );

      assert.equal(quitacoes.length, 1);
      assert.equal(quitacoes[0].args.valor, garantia);
      assert.equal(quitacoes[0].args.atrasoMinutos, 300n);
      assert.equal(quitacoes[0].args.hashCpf, hashCpf(CPF_ANA));
    });
  });

  describe("garantia da companhia", () => {
    it("devolve a garantia do voo pontual e permite o resgate", async () => {
      await embarcar("AD4021", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("AD4021", CHEGADA + 30 * 60);

      assert.equal(await contrato.saldoLiberado(companhia.address), garantia);

      await contrato.connect(companhia).resgatarGarantias(garantia);

      assert.equal(await contrato.saldoLiberado(companhia.address), 0n);
      assert.equal(await ethers.provider.getBalance(await contrato.getAddress()), 0n);
    });

    it("nao devolve garantia de voo atrasado", async () => {
      await embarcar("G31702", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);

      assert.equal(await contrato.saldoLiberado(companhia.address), 0n);

      await assert.rejects(
        contrato.connect(companhia).resgatarGarantias(garantia),
        /Saldo liberado insuficiente/
      );
    });

    it("nao deixa a companhia sacar mais do que foi liberado", async () => {
      await embarcar("AD4021", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("AD4021", CHEGADA);

      await assert.rejects(
        contrato.connect(companhia).resgatarGarantias(garantia + 1n),
        /Saldo liberado insuficiente/
      );
    });
  });

  describe("vinculo de carteira", () => {
    it("so a plataforma vincula", async () => {
      await assert.rejects(
        contrato.connect(companhia).vincularCarteira(hashCpf(CPF_ANA), passageiro.address),
        /Somente a plataforma vincula carteiras/
      );
    });

    it("recusa vincular o mesmo CPF duas vezes", async () => {
      await contrato.connect(plataforma).vincularCarteira(hashCpf(CPF_ANA), passageiro.address);

      await assert.rejects(
        contrato.connect(plataforma).vincularCarteira(hashCpf(CPF_ANA), intruso.address),
        /CPF ja possui carteira vinculada/
      );
    });
  });

  describe("auditoria do TJPB", () => {
    it("lista todos os voos e bilhetes sem exigir permissao", async () => {
      await embarcar("G31702", CPF_ANA);
      await embarcar("AD4021", CPF_BRUNO);

      // Lido pela conta do Tribunal: nenhuma função de escrita é oferecida.
      const voos = await contrato.connect(tjpb).listarTodosOsVoos();
      assert.equal(voos.length, 2);
      assert.equal(await contrato.connect(tjpb).totalDeVoos(), 2n);

      const bilhetes = await contrato.connect(tjpb).listarBilhetesDoVoo(voos[0]);
      assert.equal(bilhetes.length, 1);
    });

    it("reporta o saldo custodiado no contrato", async () => {
      await embarcar("G31702", CPF_ANA);
      await embarcar("AD4021", CPF_BRUNO);

      assert.equal(await contrato.saldoCustodiado(), garantia * 2n);
    });

    it("resume o que existe para um CPF", async () => {
      await embarcar("G31702", CPF_ANA);
      await contrato.connect(oraculo).reportarChegada("G31702", CHEGADA + 5 * HORA);

      const [depositado, retido, carteira] = await contrato.resumoDoCpf(hashCpf(CPF_ANA));

      assert.equal(depositado, 0n);
      assert.equal(retido, garantia);
      assert.equal(carteira, ZERO);
    });
  });
});
