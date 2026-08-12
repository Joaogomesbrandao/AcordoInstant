/** Erro com código HTTP, tratado pelo middleware de erro do Express. */
export class ErroApi extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

export const erroDeUso = (mensagem) => new ErroApi(mensagem, 400);
export const naoEncontrado = (mensagem) => new ErroApi(mensagem, 404);
export const conflito = (mensagem) => new ErroApi(mensagem, 409);

/**
 * Traduz a revert do contrato para uma mensagem legível.
 *
 * O ethers embrulha o motivo original em camadas de contexto; para a
 * interface, o que importa é a razão que o `require` do contrato devolveu.
 */
export function traduzirErroDeContrato(erro) {
  const motivo = erro?.reason ?? erro?.info?.error?.message ?? erro?.shortMessage ?? erro?.message;
  return new ErroApi(String(motivo ?? "Falha na transacao").replace(/^execution reverted:?\s*/i, ""), 400);
}
