// Zero Floating-Point Drift Financial Calculation Engine for Pakistani Rupee (PKR)

/**
 * Converts money to integer paisas (cents) to avoid IEEE-754 drift, sums them, and converts back.
 */
export function addMoney(...amounts: (number | string | undefined | null)[]): number {
  const sumInPaisas = amounts.reduce<number>((acc, val) => {
    if (val === undefined || val === null || val === '') return acc;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return acc;
    return acc + Math.round(num * 100);
  }, 0);
  return sumInPaisas / 100;
}

/**
 * Subtracts values using integer paisas to prevent fractional rounding leaks.
 */
export function subtractMoney(base: number | string, ...subtractions: (number | string | undefined | null)[]): number {
  const baseNum = typeof base === 'string' ? parseFloat(base) : base;
  let remainingInPaisas = Math.round((isNaN(baseNum) ? 0 : baseNum) * 100);

  for (const sub of subtractions) {
    if (sub === undefined || sub === null || sub === '') continue;
    const num = typeof sub === 'string' ? parseFloat(sub) : sub;
    if (!isNaN(num)) {
      remainingInPaisas -= Math.round(num * 100);
    }
  }

  return remainingInPaisas / 100;
}

/**
 * Performs rounded multiplication with exact penny/paisa precision.
 */
export function multiplyMoney(amount: number | string, factor: number | string): number {
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  const factorNum = typeof factor === 'string' ? parseFloat(factor) : factor;
  if (isNaN(amountNum) || isNaN(factorNum)) return 0;

  const resultInPaisas = Math.round(amountNum * factorNum * 100);
  return resultInPaisas / 100;
}

/**
 * Rounds to nearest whole rupee when Pakistani cash rounding is enabled in POS settings.
 * Returns both the rounded total and the penny rounding adjustment difference.
 */
export function calculateRounding(amount: number, enabled: boolean = true): { roundedAmount: number; roundingDifference: number } {
  if (!enabled) {
    return {
      roundedAmount: amount,
      roundingDifference: 0
    };
  }
  const rounded = Math.round(amount);
  const diff = subtractMoney(rounded, amount);
  return {
    roundedAmount: rounded,
    roundingDifference: diff
  };
}

/**
 * Formats Pakistani currency (PKR) nicely: e.g. "Rs. 1,450" or "Rs. 140.50"
 */
export function formatMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return 'Rs. 0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'Rs. 0';

  const parts = num.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decPart = parts[1];

  if (decPart === '00') {
    return `Rs. ${intPart}`;
  }
  return `Rs. ${intPart}.${decPart}`;
}

/**
 * Reciprocal portion calculation:
 * Given selling price per full plate and rupee amount (e.g. Rs 50 for Rs 260 item),
 * calculates the fractional portion (e.g. 50 / 260 = 0.19 portions)
 */
export function calculatePortionFromAmount(sellingPrice: number, rupeeAmount: number): number {
  if (!sellingPrice || sellingPrice <= 0 || !rupeeAmount || rupeeAmount <= 0) return 0;
  const portion = rupeeAmount / sellingPrice;
  return Math.round(portion * 100) / 100;
}

/**
 * Given selling price per full plate and portion (e.g. 0.5 portion for Rs 260 item),
 * calculates exact rupee price (e.g. 130)
 */
export function calculateAmountFromPortion(sellingPrice: number, portion: number): number {
  if (!sellingPrice || sellingPrice <= 0 || !portion || portion <= 0) return 0;
  return multiplyMoney(sellingPrice, portion);
}

