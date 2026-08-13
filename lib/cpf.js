import { solidityPackedKeccak256 } from "ethers";

/**
 * CPF: validação e derivação do identificador on-chain.
 *
 * O CPF em claro nunca chega ao contrato. O que vai para a cadeia é
 * `keccak256(pepper, cpf)`, calculado aqui, fora da blockchain.
 *
 * O pepper existe porque um CPF tem só 11 dígitos: um `keccak256` do número
 * puro seria reversível por força bruta em pouco tempo, e o hash voltaria a
 * ser, na prática, um dado pessoal. Com um segredo que nunca sai do
 * servidor, o hash publicado deixa de ser reversível por quem só observa a
 * cadeia.
 *
 * Em produção o pepper viveria em um HSM/cofre de segredos e seria rotacionado
 * com uma política própria; aqui ele vem de `CPF_PEPPER` no `.env`, com um
 * valor padrão para a demonstração funcionar sem configuração extra.
 */
const PEPPER_PADRAO = "acordoinstant.esma-pb.2026";

function pepper() {
  return process.env.CPF_PEPPER || PEPPER_PADRAO;
}

/** Remove pontuação e espaços, devolvendo apenas os 11 dígitos. */
export function normalizarCpf(cpf) {
  return String(cpf ?? "").replace(/\D/g, "");
}

/** Valida o CPF pelos dois dígitos verificadores. */
export function cpfValido(cpf) {
  const digitos = normalizarCpf(cpf);

  if (digitos.length !== 11) return false;
  // Sequências como 111.111.111-11 passam no cálculo, mas não são CPFs reais.
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const verificador = (ate) => {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) {
      soma += Number(digitos[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return verificador(9) === Number(digitos[9]) && verificador(10) === Number(digitos[10]);
}

/** Identificador on-chain do passageiro: `keccak256(pepper, cpf)`. */
export function hashCpf(cpf) {
  const digitos = normalizarCpf(cpf);
  if (digitos.length !== 11) {
    throw new Error("CPF deve conter 11 digitos");
  }

  return solidityPackedKeccak256(["string", "string"], [pepper(), digitos]);
}

/**
 * Completa nove dígitos com os dois verificadores, gerando um CPF válido.
 *
 * Serve aos testes e aos dados de demonstração: eles precisam de CPFs que
 * passem na validação sem usar o número de nenhuma pessoa real.
 */
export function gerarCpf(base) {
  const digitos = normalizarCpf(base).padStart(9, "0").slice(0, 9);

  const verificador = (parcial) => {
    let soma = 0;
    for (let i = 0; i < parcial.length; i += 1) {
      soma += Number(parcial[i]) * (parcial.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiro = verificador(digitos);
  const segundo = verificador(`${digitos}${primeiro}`);

  return `${digitos}${primeiro}${segundo}`;
}

/** `"12345678901"` -> `"123.456.789-01"`, só para exibição fora da cadeia. */
export function formatarCpf(cpf) {
  const digitos = normalizarCpf(cpf);
  if (digitos.length !== 11) return String(cpf ?? "");

  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/** `"12345678901"` -> `"***.***.789-01"`, para telas e logs off-chain. */
export function mascararCpf(cpf) {
  const digitos = normalizarCpf(cpf);
  if (digitos.length !== 11) return "***";

  return `***.***.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}
