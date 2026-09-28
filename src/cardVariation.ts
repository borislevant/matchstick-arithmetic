export type SymbolVariation = {
  scale: number;
  rotation: number;
};

function seededUnit(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

/**
 * Keeps a card visually identical on every device while making the same
 * symbol look different when it appears on another card.
 */
export function getSymbolVariation(cardId: number, symbolId: number, index: number): SymbolVariation {
  const seed = Math.imul(cardId + 1, 0x45d9f3b) ^
    Math.imul(symbolId + 1, 0x27d4eb2d) ^
    Math.imul(index + 1, 0x165667b1);

  return {
    scale: 0.5 + seededUnit(seed),
    rotation: -45 + seededUnit(seed ^ 0x9e3779b9) * 90,
  };
}
