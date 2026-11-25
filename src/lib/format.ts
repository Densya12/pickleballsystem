/** "₱1,500" */
export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

/** "09171234567" → "0917 123 4567" (other values are returned as-is). */
export function formatGcashNumber(number: string): string {
  return /^09\d{9}$/.test(number) ? `${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}` : number;
}
