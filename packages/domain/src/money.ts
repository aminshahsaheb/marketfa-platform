export type CurrencyCode = "IRR";
export type MoneyInputUnit = "IRR" | "TOMAN";
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}
const INTEGER_PATTERN = /^-?(0|[1-9][0-9]*)$/;
export function parseIntegerAmount(value: string): bigint {
  if (!INTEGER_PATTERN.test(value))
    throw new TypeError("Amount must be a base-10 integer string.");
  return BigInt(value);
}
export function toCanonicalIrr(value: string, unit: MoneyInputUnit): Money {
  const amount = parseIntegerAmount(value);
  return {
    amountMinor: unit === "TOMAN" ? amount * 10n : amount,
    currency: "IRR",
  };
}
export function irrToExactToman(amountIrr: bigint): string {
  const negative = amountIrr < 0n;
  const absolute = negative ? -amountIrr : amountIrr;
  const whole = absolute / 10n;
  const remainder = absolute % 10n;
  const sign = negative ? "-" : "";
  return remainder === 0n ? `${sign}${whole}` : `${sign}${whole}.${remainder}`;
}
