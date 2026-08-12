import { HDNodeWallet, Mnemonic } from "ethers";

/**
 * Carteiras do protótipo, derivadas na implantação da rede local.
 *
 * Todas saem do mesmo mnemônico determinístico que o `npx hardhat node`
 * usa por padrão. A consequência prática é que ninguém precisa copiar chave
 * privada para lugar nenhum: o deploy, o backend, o oráculo e os testes
 * derivam exatamente as mesmas contas, sempre nos mesmos índices.
 *
 * Este mnemônico é público e conhecido — vale só para a rede local
 * descartável. Nunca reaproveitar em rede pública.
 */
export const MNEMONICO_PADRAO =
  "test test test test test test test test test test test junk";

const CAMINHO_BASE = "m/44'/60'/0'/0";

/** Papéis institucionais do sistema, na ordem em que a rede os cria. */
export const PAPEIS = {
  companhia: {
    indice: 0,
    nome: "Companhia aerea",
    resumo: "Cadastra voos, registra bilhetes, deposita a garantia e resgata voos pontuais"
  },
  oraculo: {
    indice: 1,
    nome: "Oraculo",
    resumo: "Unica conta autorizada a escrever o horario real de chegada"
  },
  tjpb: {
    indice: 2,
    nome: "TJPB",
    resumo: "No validador: le e audita o registro, sem poder alterar nada"
  },
  plataforma: {
    indice: 3,
    nome: "Plataforma",
    resumo: "Vincula o hash do CPF a carteira informada pelo cliente no cadastro"
  }
};

/** Índice da primeira das cinco carteiras de teste de passageiros. */
export const PRIMEIRO_USUARIO = 4;
export const TOTAL_USUARIOS_TESTE = 5;

function mnemonico() {
  return process.env.MNEMONIC || MNEMONICO_PADRAO;
}

/** Deriva a carteira de um índice do mnemônico da rede. */
export function carteiraPorIndice(indice) {
  const frase = Mnemonic.fromPhrase(mnemonico());
  return HDNodeWallet.fromMnemonic(frase, `${CAMINHO_BASE}/${indice}`);
}

/** Deriva a carteira de um papel institucional (`companhia`, `oraculo`, ...). */
export function carteiraDoPapel(papel) {
  const definicao = PAPEIS[papel];
  if (!definicao) {
    throw new Error(`Papel desconhecido: ${papel}`);
  }

  return carteiraPorIndice(definicao.indice);
}

/**
 * As cinco carteiras de teste de passageiros.
 *
 * Elas são apenas geradas: nenhum usuário nasce cadastrado no sistema. O
 * cliente só passa a existir quando informa nome, CPF e a chave pública na
 * tela de cadastro — que é justamente o momento em que qualquer indenização
 * já retida para o CPF dele é depositada.
 */
export function carteirasDeTeste() {
  return Array.from({ length: TOTAL_USUARIOS_TESTE }, (_, posicao) => {
    const indice = PRIMEIRO_USUARIO + posicao;
    const carteira = carteiraPorIndice(indice);

    return {
      indice,
      rotulo: `Usuario de teste ${posicao + 1}`,
      endereco: carteira.address,
      chavePrivada: carteira.privateKey
    };
  });
}

/** Endereços de todos os papéis institucionais, para registro e configuração. */
export function enderecosDosPapeis() {
  return Object.fromEntries(
    Object.entries(PAPEIS).map(([papel, definicao]) => [
      papel,
      { ...definicao, endereco: carteiraPorIndice(definicao.indice).address }
    ])
  );
}
