import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DSQLTokenQuery } from '../../src/dsql/tokens.js';
import type { DtifFlattenedToken, ResolvedDtifGraph, DeprecationLedger } from '../../src/types.js';

function makeToken(pointer: string, type: string, value: unknown): DtifFlattenedToken {
  return {
    id: pointer,
    pointer,
    name: pointer.replace(/^#\//, '').replaceAll('/', '.'),
    path: pointer.replace(/^#\//, '').split('/'),
    type,
    value: value as DtifFlattenedToken['value'],
  };
}

function makeGraph(tokens: DtifFlattenedToken[]): ResolvedDtifGraph {
  const byType = new Map<string, DtifFlattenedToken[]>();
  for (const token of tokens) {
    if (token.type) {
      const group = byType.get(token.type) ?? [];
      byType.set(token.type, [...group, token]);
    }
  }
  return {
    tokens: new Map(tokens.map((t) => [t.pointer, t])),
    byType,
    sources: ['tokens.json'],
  };
}

function makeEmptyLedger(): DeprecationLedger {
  return { entries: new Map() };
}

describe('DSQLTokenQuery.byPointer', () => {
  it('returns the token at a known pointer', async () => {
    const token = makeToken('#/color/primary', 'color', '#3B82F6');
    const query = new DSQLTokenQuery(makeGraph([token]), makeEmptyLedger());
    const result = await query.byPointer('#/color/primary');
    assert.deepEqual(result, token);
  });

  it('returns null for an unknown pointer', async () => {
    const query = new DSQLTokenQuery(makeGraph([]), makeEmptyLedger());
    const result = await query.byPointer('#/color/nonexistent');
    assert.equal(result, null);
  });
});

describe('DSQLTokenQuery.forProperty', () => {
  it('returns color tokens for the color CSS property', async () => {
    const colorToken = makeToken('#/color/primary', 'color', '#3B82F6');
    const sizeToken = makeToken('#/size/base', 'fontSizes', '16px');
    const query = new DSQLTokenQuery(makeGraph([colorToken, sizeToken]), makeEmptyLedger());
    const result = await query.forProperty('color');
    assert.equal(result.length, 1);
    assert.equal(result[0], colorToken);
  });

  it('excludes deprecated tokens', async () => {
    const token = makeToken('#/color/old', 'color', '#000');
    const ledger: DeprecationLedger = {
      entries: new Map([['#/color/old', { pointer: '#/color/old', replacement: '#/color/new' }]]),
    };
    const query = new DSQLTokenQuery(makeGraph([token]), ledger);
    const result = await query.forProperty('color');
    assert.equal(result.length, 0);
  });
});

describe('DSQLTokenQuery.deprecated', () => {
  it('returns deprecated tokens with their entries', async () => {
    const token = makeToken('#/color/old', 'color', '#000');
    const entry = { pointer: '#/color/old', replacement: '#/color/new' };
    const ledger: DeprecationLedger = { entries: new Map([['#/color/old', entry]]) };
    const query = new DSQLTokenQuery(makeGraph([token]), ledger);
    const result = await query.deprecated();
    assert.equal(result.length, 1);
    assert.equal(result[0]?.token, token);
    assert.deepEqual(result[0]?.entry, entry);
  });
});

describe('DSQLTokenQuery.withReplacement', () => {
  it('returns the replacement pointer for a deprecated token', async () => {
    const token = makeToken('#/color/old', 'color', '#000');
    const ledger: DeprecationLedger = {
      entries: new Map([['#/color/old', { pointer: '#/color/old', replacement: '#/color/new' }]]),
    };
    const query = new DSQLTokenQuery(makeGraph([token]), ledger);
    const result = await query.withReplacement('#/color/old');
    assert.equal(result, '#/color/new');
  });

  it('returns null when no replacement is set', async () => {
    const query = new DSQLTokenQuery(makeGraph([]), makeEmptyLedger());
    const result = await query.withReplacement('#/color/anything');
    assert.equal(result, null);
  });
});

describe('DSQLTokenQuery.closest', () => {
  it('returns an exact match with confidence 1', async () => {
    const token = makeToken('#/color/primary', 'color', '#3B82F6');
    const query = new DSQLTokenQuery(makeGraph([token]), makeEmptyLedger());
    const result = await query.closest('#3B82F6', 'color');
    assert.ok(result.length > 0);
    assert.equal(result[0]?.confidence, 1);
    assert.equal(result[0]?.distanceMetric, 'exact');
  });

  it('ranks tokens by descending confidence', async () => {
    const close = makeToken('#/color/a', 'color', '#3B82F6');
    const far = makeToken('#/color/b', 'color', '#FF0000');
    const query = new DSQLTokenQuery(makeGraph([close, far]), makeEmptyLedger());
    const result = await query.closest('#3B82F6', 'color');
    if (result.length >= 2) {
      assert.ok(result[0].confidence >= result[1].confidence);
    }
  });

  it('uses colour-delta-e metric for rgb() color values', async () => {
    const token = makeToken('#/color/blue', 'color', 'rgb(59, 130, 246)');
    const query = new DSQLTokenQuery(makeGraph([token]), makeEmptyLedger());
    // Slightly different rgb value — forces colour-delta-e comparison
    const result = await query.closest('rgb(60, 130, 246)', 'color');
    assert.ok(result.length > 0);
    assert.equal(result[0]?.distanceMetric, 'colour-delta-e');
  });

  it('uses colour-delta-e metric for similar hex colors', async () => {
    const token = makeToken('#/color/blue', 'color', '#3B82F6');
    const query = new DSQLTokenQuery(makeGraph([token]), makeEmptyLedger());
    const result = await query.closest('#3B83F6', 'color');
    assert.ok(result.length > 0);
    assert.equal(result[0]?.distanceMetric, 'colour-delta-e');
  });

  it('uses numeric-proximity metric for numeric values', async () => {
    const token = makeToken('#/size/base', 'fontSizes', '16px');
    const query = new DSQLTokenQuery(makeGraph([token]), makeEmptyLedger());
    const result = await query.closest('14px', 'font-size');
    assert.ok(result.length > 0);
    assert.equal(result[0]?.distanceMetric, 'numeric-proximity');
  });

  it('excludes deprecated tokens', async () => {
    const token = makeToken('#/color/old', 'color', '#3B82F6');
    const ledger: DeprecationLedger = {
      entries: new Map([['#/color/old', { pointer: '#/color/old' }]]),
    };
    const query = new DSQLTokenQuery(makeGraph([token]), ledger);
    const result = await query.closest('#3B82F6', 'color');
    assert.equal(result.length, 0);
  });

  it('returns empty array when no tokens score above 0', async () => {
    const token = makeToken('#/color/primary', 'color', 'notacolor');
    const query = new DSQLTokenQuery(makeGraph([token]), makeEmptyLedger());
    const result = await query.closest('otherthing', 'background-color');
    assert.equal(result.length, 0);
  });
});

describe('DSQLTokenQuery type filter', () => {
  it('closest() uses the byType index when a type filter is set', async () => {
    const colorToken = makeToken('#/color/primary', 'color', '#3B82F6');
    const sizeToken = makeToken('#/size/base', 'fontSizes', '16px');
    // Only color tokens should appear in results
    const query = new DSQLTokenQuery(
      makeGraph([colorToken, sizeToken]),
      makeEmptyLedger(),
      'color',
    );
    const result = await query.closest('#3B82F6', 'color');
    assert.ok(result.length > 0);
    assert.ok(result.every((r) => r.token.type === 'color'));
  });

  it('forProperty() falls back to all tokens for an unknown CSS property', async () => {
    const token = makeToken('#/misc/value', 'other', 'foo');
    const query = new DSQLTokenQuery(makeGraph([token]), makeEmptyLedger());
    // 'unknown-property' has no known type mapping — falls back to all tokens
    const result = await query.forProperty('unknown-property');
    assert.equal(result.length, 1);
  });

  it('forProperty() falls back through #tokens() with type filter for unknown property', async () => {
    const colorToken = makeToken('#/color/primary', 'color', '#3B82F6');
    const sizeToken = makeToken('#/size/base', 'fontSizes', '16px');
    const query = new DSQLTokenQuery(
      makeGraph([colorToken, sizeToken]),
      makeEmptyLedger(),
      'color',
    );
    // With type='color', the fallback path returns only color tokens
    const result = await query.forProperty('unknown-property');
    assert.ok(result.every((r) => r.type === 'color'));
  });
});
