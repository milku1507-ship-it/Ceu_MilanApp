
export const UNIT_DETAILS: Record<string, { base: string, rate: number }> = {
  'gram': { base: 'gram', rate: 1 },
  'gr': { base: 'gram', rate: 1 },
  'g': { base: 'gram', rate: 1 },
  'kg': { base: 'gram', rate: 1000 },
  'kilogram': { base: 'gram', rate: 1000 },
  'ml': { base: 'ml', rate: 1 },
  'mililiter': { base: 'ml', rate: 1 },
  'liter': { base: 'ml', rate: 1000 },
  'l': { base: 'ml', rate: 1000 },
  'mg': { base: 'mg', rate: 1 },
  'miligram': { base: 'mg', rate: 1 },
  'cm': { base: 'cm', rate: 1 },
  'centimeter': { base: 'cm', rate: 1 },
  'm': { base: 'cm', rate: 100 },
  'meter': { base: 'cm', rate: 100 },
};

export function getBaseUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_DETAILS[lower]?.base || lower;
}

export function getConversionRate(unit: string): number {
  const lower = unit.toLowerCase().trim();
  return UNIT_DETAILS[lower]?.rate || 1;
}

/**
 * Converts a value from a display unit to its base unit.
 * Example: toBaseValue(1, 'kg') -> 1000 (since base is gram)
 */
export function toBaseValue(value: number, unit: string): number {
  return value * getConversionRate(unit);
}

/**
 * Converts a value from a base unit to a display unit.
 * Example: fromBaseValue(1000, 'kg') -> 1
 */
export function fromBaseValue(value: number, unit: string): number {
  const rate = getConversionRate(unit);
  return value / rate;
}

export function formatSmartUnit(value: number, unit: string): string {
  if (!unit) return `${value}`;
  const base = getBaseUnit(unit);
  const rate = getConversionRate(unit);
  const valInBase = value * rate;

  // Gram/Kg logic
  if (base === 'gram') {
    if (Math.abs(valInBase) >= 1000) {
      return `${Number((valInBase / 1000).toFixed(3))} kg`;
    }
    return `${Number(valInBase.toFixed(3))} gram`;
  }
  
  // Ml/Liter logic
  if (base === 'ml') {
    if (Math.abs(valInBase) >= 1000) {
      return `${Number((valInBase / 1000).toFixed(3))} liter`;
    }
    return `${Number(valInBase.toFixed(3))} ml`;
  }

  // Mg to Gram
  if (base === 'mg') {
    if (Math.abs(valInBase) >= 1000) {
      return `${Number((valInBase / 1000).toFixed(3))} gram`;
    }
    return `${Number(valInBase.toFixed(3))} mg`;
  }

  // Cm to Meter
  if (base === 'cm') {
    if (Math.abs(valInBase) >= 100) {
      return `${Number((valInBase / 100).toFixed(3))} m`;
    }
    return `${Number(valInBase.toFixed(3))} cm`;
  }

  // Default: return value and unit as is
  return `${value} ${unit}`;
}
