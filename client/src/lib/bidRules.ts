export function parseBrazilianAmount(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  return Number(normalized) || 0;
}

export function isValidBid(value: string, currentBid: number, isRoundClosed = false): boolean {
  return !isRoundClosed && parseBrazilianAmount(value) > currentBid;
}

export function isValidWithdrawal(amount: string, pixKey: string, availableBalance: number): boolean {
  const requested = parseBrazilianAmount(amount);
  return Boolean(pixKey.trim()) && requested > 0 && requested <= availableBalance;
}
