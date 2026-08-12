import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { carteiraDoPapel } from "../../../deploy/contas.js";

/**
 * Acesso ao contrato, um cliente por papel.
 *
 * Cada papel assina com a própria carteira, e é isso que faz o controle de
 * acesso do contrato valer na prática: o backend simplesmente não tem como
 * reportar um voo pela companhia, porque a função exige a assinatura do
 * oráculo.
 */
export function criarAcessoAoContrato(config) {
  const provedor = new JsonRpcProvider(
    config.rpcUrl,
    { chainId: config.chainId, name: config.rede },
    {
      staticNetwork: true,
      // Sem isso, duas ações seguidas da companhia reaproveitam um
      // `eth_getTransactionCount` em cache e a segunda transação falha com
      // "nonce has already been used".
      cacheTimeout: -1
    }
  );

  const assinante = (papel) => carteiraDoPapel(papel).connect(provedor);

  const carteiras = {
    companhia: assinante("companhia"),
    oraculo: assinante("oraculo"),
    plataforma: assinante("plataforma")
  };

  const leitura = new Contract(config.contrato, config.abi, provedor);

  return {
    provedor,
    endereco: config.contrato,
    carteiras,

    /** Contrato somente-leitura: consultas, eventos e painéis. */
    leitura,

    /** Contrato assinado pela companhia aérea. */
    comoCompanhia: new Contract(config.contrato, config.abi, carteiras.companhia),

    /** Contrato assinado pelo oráculo. */
    comoOraculo: new Contract(config.contrato, config.abi, carteiras.oraculo),

    /** Contrato assinado pela plataforma (vinculação de carteira). */
    comoPlataforma: new Contract(config.contrato, config.abi, carteiras.plataforma),

    /** Carteira que representa a companhia aérea única do protótipo. */
    enderecoDaCompanhia: carteiras.companhia.address,
    enderecoDoOraculo: carteiras.oraculo.address,
    enderecoDoTjpb: config.papeis?.tjpb ?? null,

    /** Confere que a rede está no ar e que há contrato no endereço. */
    async verificar() {
      const codigo = await provedor.getCode(config.contrato);
      if (codigo === "0x") {
        throw new Error(
          `Nenhum contrato em ${config.contrato} na rede ${config.rede}. ` +
            'Rode "npm run deploy" novamente.'
        );
      }
    }
  };
}

/** Carteira avulsa a partir de uma chave privada (usado só em scripts). */
export function carteiraDeChave(chave, provedor) {
  return new Wallet(chave, provedor);
}
