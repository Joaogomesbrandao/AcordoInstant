import { brl, curto } from "../../../lib/formato.js";

/**
 * Painel do TJPB: o nó validador.
 *
 * O Tribunal não tem nenhuma função de escrita neste serviço, e isso é
 * proposital: a proposta define o TJPB como validador que audita, não como
 * parte que interfere. Tudo aqui sai de funções `view` do contrato e dos
 * eventos já registrados.
 *
 * O item central é o termo de quitação: se o passageiro ingressar no
 * Juizado depois de já ter sido indenizado automaticamente, é esta lista
 * que comprova a quitação dos danos materiais imediatos daquele bilhete.
 */
export function criarServicoDoTribunal({ acesso, consultas, manifesto }) {
  const contrato = acesso.leitura;

  /** Termos de quitação emitidos, lidos direto dos eventos da cadeia. */
  async function quitacoes(catalogo) {
    const eventos = await contrato.queryFilter(contrato.filters.QuitacaoEmitida());

    return eventos
      .map((evento) => ({
        bilheteId: evento.args.bilheteId,
        bilheteCurto: curto(evento.args.bilheteId),
        voo: catalogo?.codigoDoBilhete(evento.args.bilheteId) ?? curto(evento.args.bilheteId),
        hashCpf: evento.args.hashCpf,
        hashCpfCurto: curto(evento.args.hashCpf),
        valor: brl(evento.args.valor),
        atrasoMinutos: Number(evento.args.atrasoMinutos),
        emitidoEm: Number(evento.args.instante),
        txHash: evento.transactionHash,
        txCurto: curto(evento.transactionHash),
        bloco: evento.blockNumber
      }))
      .reverse();
  }

  async function painel(catalogo = null) {
    const ids = await contrato.listarTodosOsVoos();
    const voos = await consultas.listarVoos(ids);

    const bilhetes = voos.flatMap((voo) => voo.bilhetes);
    const indenizados = bilhetes.filter((bilhete) => bilhete.indenizado);
    const emEscrow = bilhetes.filter((bilhete) => bilhete.status === "Ativo");

    return {
      regra: await consultas.regra(),
      identidade: {
        contrato: acesso.endereco,
        no: acesso.enderecoDoTjpb,
        // Explicita a natureza do papel: o painel não expõe nenhuma ação de
        // escrita porque o contrato não dá nenhuma ao Tribunal.
        permissoes: "somente leitura: o TJPB audita o registro e nao pode alterar contratos"
      },
      totais: {
        voos: voos.length,
        aguardandoOraculo: voos.filter((voo) => !voo.apurado).length,
        pontuais: voos.filter((voo) => voo.apurado && !voo.atrasado).length,
        atrasados: voos.filter((voo) => voo.atrasado).length,
        bilhetes: bilhetes.length,
        indenizacoes: indenizados.length,
        totalIndenizado: brl(
          indenizados.reduce((total, bilhete) => total + BigInt(bilhete.garantiaWei), 0n)
        ),
        garantiasAtivas: emEscrow.length,
        emEscrow: brl(emEscrow.reduce((total, bilhete) => total + BigInt(bilhete.garantiaWei), 0n))
      },
      voos,
      quitacoes: await quitacoes(catalogo),
      // O manifesto de nomes fica com a companhia: o Tribunal audita o
      // contrato pelo hash, sem precisar de dado pessoal nenhum.
      observacao:
        "Nenhum dado pessoal e registrado na blockchain. O passageiro e identificado " +
        "pelo hash do CPF, e o bilhete pelo hash do voo com esse identificador."
    };
  }

  return { painel, quitacoes, manifesto };
}
