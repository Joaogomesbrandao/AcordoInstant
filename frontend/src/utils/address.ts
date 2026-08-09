import { isAddress } from 'ethers';

export function isValidAddress(value: string): boolean {
  return isAddress(value.trim());
}

export function truncateAddress(value: string, chars = 4): string {
  if (!value || value.length < chars * 2 + 2) return value;
  return `${value.slice(0, chars + 2)}…${value.slice(-chars)}`;
}
