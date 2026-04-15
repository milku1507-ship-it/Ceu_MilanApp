
export function formatSmartUnit(value: number, unit: string): string {
  const lowerUnit = unit.toLowerCase().trim();
  
  // Gram to Kilogram
  if (lowerUnit === 'gram' || lowerUnit === 'gr' || lowerUnit === 'g') {
    if (Math.abs(value) >= 1000) {
      const kgValue = value / 1000;
      return `${Number(kgValue.toFixed(3))} kg`;
    }
    return `${value} ${unit}`;
  }
  
  // Milliliter to Liter
  if (lowerUnit === 'ml' || lowerUnit === 'mililiter') {
    if (Math.abs(value) >= 1000) {
      const literValue = value / 1000;
      return `${Number(literValue.toFixed(3))} liter`;
    }
    return `${value} ${unit}`;
  }

  // Milligram to Gram
  if (lowerUnit === 'mg' || lowerUnit === 'miligram') {
    if (Math.abs(value) >= 1000) {
      const gramValue = value / 1000;
      return `${Number(gramValue.toFixed(3))} gram`;
    }
    return `${value} ${unit}`;
  }

  // Centimeter to Meter
  if (lowerUnit === 'cm' || lowerUnit === 'centimeter') {
    if (Math.abs(value) >= 100) {
      const meterValue = value / 100;
      return `${Number(meterValue.toFixed(3))} m`;
    }
    return `${value} ${unit}`;
  }

  // Default: return value and unit as is
  return `${value} ${unit}`;
}

/**
 * Splits a formatted string back into value and unit if needed, 
 * but usually we just need the display string.
 */
export function getSmartUnitDisplay(value: number, unit: string): { value: number, unit: string } {
  const lowerUnit = unit.toLowerCase().trim();
  
  if ((lowerUnit === 'gram' || lowerUnit === 'gr' || lowerUnit === 'g') && Math.abs(value) >= 1000) {
    return { value: value / 1000, unit: 'kg' };
  }
  
  if ((lowerUnit === 'ml' || lowerUnit === 'mililiter') && Math.abs(value) >= 1000) {
    return { value: value / 1000, unit: 'liter' };
  }

  if ((lowerUnit === 'mg' || lowerUnit === 'miligram') && Math.abs(value) >= 1000) {
    return { value: value / 1000, unit: 'gram' };
  }

  if ((lowerUnit === 'cm' || lowerUnit === 'centimeter') && Math.abs(value) >= 100) {
    return { value: value / 100, unit: 'm' };
  }

  return { value, unit };
}
