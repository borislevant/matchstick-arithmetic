import { type Glyph, bits, DIGITS } from './engine';

export type VerticalSpec = {
  addends: number[]; // positive integers
  result: number;    // target result
  digits: number;    // number of columns (place values)
};

// Convert VerticalSpec to a linear expression string like '123+45=168'
export function verticalSpecToExpression(spec: VerticalSpec): string {
  const a = spec.addends.map(n => String(n)).join('+');
  return `${a}=${spec.result}`;
}

// Convert expression into Glyph[] compatible with engine; keeps optional unary minus support off
export function verticalSpecToGlyphs(spec: VerticalSpec): Glyph[] {
  const expr = verticalSpecToExpression(spec);
  const glyphs: Glyph[] = [];
  for (const ch of expr) {
    if (/\d/.test(ch)) glyphs.push({ type: 'digit', initialSegments: bits(DIGITS[Number(ch)]) });
    else if (ch === '+') glyphs.push({ type: 'plus', initialSegments: bits('11') });
    else if (ch === '-') glyphs.push({ type: 'minus', initialSegments: bits('10') });
    else if (ch === '=') glyphs.push({ type: 'equals', initialSegments: bits('11') });
    else if (ch === '×') glyphs.push({ type: 'times', initialSegments: bits('11') });
  }
  return glyphs;
}
