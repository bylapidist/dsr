import type {
  DtifFlattenedToken,
  TokenType,
  RankedToken,
  DeprecatedToken,
  ResolvedDtifGraph,
  DeprecationLedger,
  DistanceMetric,
} from '../types.js';

/**
 * Executes token queries directly against the in-memory graph.
 * Methods return Promises to match the remote DSQLClient interface.
 */
export class DSQLTokenQuery {
  readonly #graph: ResolvedDtifGraph;
  readonly #deprecationLedger: DeprecationLedger;
  readonly #type: TokenType | undefined;

  constructor(graph: ResolvedDtifGraph, deprecationLedger: DeprecationLedger, type?: TokenType) {
    this.#graph = graph;
    this.#deprecationLedger = deprecationLedger;
    this.#type = type;
  }

  #tokens(): readonly DtifFlattenedToken[] {
    if (this.#type !== undefined) {
      return this.#graph.byType.get(this.#type) ?? [];
    }
    return [...this.#graph.tokens.values()];
  }

  /**
   * Returns tokens ranked by closeness to a raw CSS value for a given CSS property.
   * Applies colour distance for colour values, numeric proximity for numeric values,
   * and exact matching otherwise.
   */
  closest(rawValue: string, property: string): Promise<RankedToken[]> {
    const candidates = this.#tokens().filter(
      (t) => !this.#deprecationLedger.entries.has(t.pointer),
    );

    const ranked = candidates
      .map((token): RankedToken => {
        const { confidence, distanceMetric } = scoreToken(token, rawValue, property);
        return { token, confidence, distanceMetric };
      })
      .filter((r) => r.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    return Promise.resolve(ranked.slice(0, 10));
  }

  /** Returns all non-deprecated tokens applicable to a CSS property. */
  forProperty(cssProperty: string): Promise<DtifFlattenedToken[]> {
    const propertyToTypes = cssPropertyToTokenTypes(cssProperty);
    const candidates =
      propertyToTypes.length > 0
        ? propertyToTypes.flatMap((t) => [...(this.#graph.byType.get(t) ?? [])])
        : [...this.#tokens()];

    return Promise.resolve(
      candidates.filter((t) => !this.#deprecationLedger.entries.has(t.pointer)),
    );
  }

  /** Returns the token at an exact JSON pointer, or null if not found. */
  byPointer(pointer: string): Promise<DtifFlattenedToken | null> {
    return Promise.resolve(this.#graph.tokens.get(pointer) ?? null);
  }

  /** Returns all deprecated tokens along with their deprecation entries. */
  deprecated(): Promise<DeprecatedToken[]> {
    const results: DeprecatedToken[] = [];
    for (const [pointer, entry] of this.#deprecationLedger.entries) {
      const token = this.#graph.tokens.get(pointer);
      if (token) results.push({ token, entry });
    }
    return Promise.resolve(results);
  }

  /** Returns the replacement pointer for a deprecated token, or null. */
  withReplacement(pointer: string): Promise<string | null> {
    return Promise.resolve(this.#deprecationLedger.entries.get(pointer)?.replacement ?? null);
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function scoreToken(
  token: DtifFlattenedToken,
  rawValue: string,
  property: string,
): { confidence: number; distanceMetric: DistanceMetric } {
  const tokenValue = tokenValueString(token);

  if (normalise(tokenValue) === normalise(rawValue)) {
    return { confidence: 1, distanceMetric: 'exact' };
  }

  if (isColorProperty(property)) {
    const dist = approximateColorDistance(tokenValue, rawValue);
    if (dist !== null) {
      return { confidence: Math.max(0, 1 - dist), distanceMetric: 'colour-delta-e' };
    }
  }

  const tokenNum = parseFloat(tokenValue);
  const rawNum = parseFloat(rawValue);
  if (!isNaN(tokenNum) && !isNaN(rawNum) && rawNum !== 0) {
    const ratio = Math.min(tokenNum, rawNum) / Math.max(tokenNum, rawNum);
    return { confidence: ratio, distanceMetric: 'numeric-proximity' };
  }

  return { confidence: 0, distanceMetric: 'exact' };
}

function tokenValueString(token: DtifFlattenedToken): string {
  const v = token.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  return JSON.stringify(v);
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isColorProperty(property: string): boolean {
  return ['color', 'background-color', 'border-color', 'outline-color', 'fill', 'stroke'].includes(
    property.toLowerCase(),
  );
}

function approximateColorDistance(a: string, b: string): number | null {
  const rgbA = parseCssColor(a);
  const rgbB = parseCssColor(b);
  if (!rgbA || !rgbB) return null;

  const dr = (rgbA[0] - rgbB[0]) / 255;
  const dg = (rgbA[1] - rgbB[1]) / 255;
  const db = (rgbA[2] - rgbB[2]) / 255;
  return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
}

function parseCssColor(value: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex !== null) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(value.trim());
  if (rgb !== null) {
    return [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)];
  }

  return null;
}

function cssPropertyToTokenTypes(property: string): TokenType[] {
  const map: Record<string, TokenType[]> = {
    color: ['color'],
    'background-color': ['color'],
    'border-color': ['color'],
    fill: ['color'],
    stroke: ['color'],
    'font-size': ['fontSizes', 'dimension'],
    'font-weight': ['fontWeights'],
    'font-family': ['fontFamilies'],
    'letter-spacing': ['letterSpacing'],
    'line-height': ['lineHeights'],
    'border-radius': ['borderRadius'],
    'border-width': ['borderWidth'],
    'box-shadow': ['boxShadow'],
    opacity: ['opacity'],
    'animation-duration': ['duration'],
    'transition-duration': ['duration'],
    'animation-timing-function': ['cubicBezier'],
    'transition-timing-function': ['cubicBezier'],
    width: ['sizing', 'dimension'],
    height: ['sizing', 'dimension'],
    padding: ['spacing'],
    margin: ['spacing'],
    gap: ['spacing'],
  };
  return map[property.toLowerCase()] ?? [];
}
