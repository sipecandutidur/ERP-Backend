import Decimal from 'decimal.js';

/**
 * Banker's Rounding (Round half to even).
 * Rounds a number to the nearest integer. If the fractional part is exactly 0.5,
 * it rounds to the nearest even integer.
 *
 * @param value The number to round
 * @returns The rounded number
 */
export function bankersRound(value: number): number {
  if (value === null || value === undefined) return 0;
  // Use Decimal.ROUND_HALF_EVEN mode
  const decimalValue = new Decimal(value);
  return decimalValue.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber();
}
