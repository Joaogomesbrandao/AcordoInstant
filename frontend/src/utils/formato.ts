/** Formatação de exibição. Valores em reais já chegam prontos do backend. */

/** Timestamp Unix -> `"03/08 12:20"`. */
export function dataHora(timestamp: number | null | undefined): string {
  if (!timestamp) return '-';

  return new Date(timestamp * 1000)
    .toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
}

/** `"0x5FbDB2315678afecb367f032d93F642f64180aa3"` -> `"0x5FbD…0aa3"`. */
export function curto(valor: string | null | undefined, inicio = 6, fim = 4): string {
  const texto = String(valor ?? '');
  if (texto.length <= inicio + fim + 1) return texto;
  return `${texto.slice(0, inicio)}…${texto.slice(-fim)}`;
}

/** Aplica a máscara do CPF conforme o usuário digita. */
export function mascaraCpf(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);

  return digitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** Classe do selo de status de um voo. */
export function seloDoVoo(voo: { apurado: boolean; atrasado: boolean }): string {
  if (!voo.apurado) return 'badge badge-neutral';
  return voo.atrasado ? 'badge badge-warning' : 'badge badge-success';
}

/** Classe do cartão do voo, para colorir a lista pelo desfecho apurado. */
export function estadoDoVoo(voo: { apurado: boolean; atrasado: boolean }): string {
  if (!voo.apurado) return 'voo-aguardando';
  return voo.atrasado ? 'voo-atrasado' : 'voo-pontual';
}
