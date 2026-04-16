
/**
 * Formats a number into a shorter string representation for large values.
 * Examples: 
 * 1.000.000 -> 1jt
 * 1.500.000 -> 1,5jt
 * 1.000 -> 1rb
 * 500 -> 500
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1000000) {
    const num = value / 1000000;
    const formatted = num.toLocaleString('id-ID', { maximumFractionDigits: 1 });
    return `${formatted}jt`;
  }
  if (value >= 1000) {
    const num = value / 1000;
    const formatted = num.toLocaleString('id-ID', { maximumFractionDigits: 1 });
    return `${formatted}rb`;
  }
  return value.toLocaleString('id-ID');
}

/**
 * Formats a number as IDR currency with compact support for large values.
 */
export function formatCurrency(value: number, compact: boolean = false): string {
  if (compact && value >= 1000) {
    return `Rp ${formatCompactNumber(value)}`;
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}
