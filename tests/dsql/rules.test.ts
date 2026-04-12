import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DSQLRuleQuery } from '../../src/dsql/rules.js';
import type { RuleRegistry, RuleDefinition } from '../../src/types.js';

function makeRule(id: string, category: string, enabled: boolean, fixable = false): RuleDefinition {
  return {
    id,
    category,
    description: `Rule ${id}`,
    enabled,
    severity: 'error',
    options: undefined,
    fixable,
    stability: 'stable',
  };
}

function makeRegistry(rules: RuleDefinition[]): RuleRegistry {
  return { rules: new Map(rules.map((r) => [r.id, r])) };
}

describe('DSQLRuleQuery.all', () => {
  it('returns all rules when no category filter is set', async () => {
    const registry = makeRegistry([
      makeRule('no-hardcoded-color', 'tokens', true),
      makeRule('no-hardcoded-font', 'tokens', false),
    ]);
    const query = new DSQLRuleQuery(registry);
    const result = await query.all();
    assert.equal(result.length, 2);
  });

  it('filters rules by category when category is set', async () => {
    const registry = makeRegistry([
      makeRule('no-hardcoded-color', 'tokens', true),
      makeRule('component-usage', 'components', true),
    ]);
    const query = new DSQLRuleQuery(registry, 'tokens');
    const result = await query.all();
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, 'no-hardcoded-color');
  });

  it('returns empty array for empty registry', async () => {
    const query = new DSQLRuleQuery(makeRegistry([]));
    const result = await query.all();
    assert.equal(result.length, 0);
  });
});

describe('DSQLRuleQuery.enabled', () => {
  it('returns only enabled rules', async () => {
    const registry = makeRegistry([
      makeRule('enabled-rule', 'tokens', true),
      makeRule('disabled-rule', 'tokens', false),
    ]);
    const query = new DSQLRuleQuery(registry);
    const result = await query.enabled();
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, 'enabled-rule');
  });

  it('respects category filter when finding enabled rules', async () => {
    const registry = makeRegistry([
      makeRule('tokens-enabled', 'tokens', true),
      makeRule('components-enabled', 'components', true),
    ]);
    const query = new DSQLRuleQuery(registry, 'tokens');
    const result = await query.enabled();
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, 'tokens-enabled');
  });
});

describe('DSQLRuleQuery.byId', () => {
  it('returns the rule for a known id', async () => {
    const rule = makeRule('no-hardcoded-color', 'tokens', true);
    const query = new DSQLRuleQuery(makeRegistry([rule]));
    const result = await query.byId('no-hardcoded-color');
    assert.deepEqual(result, rule);
  });

  it('returns null for an unknown id', async () => {
    const query = new DSQLRuleQuery(makeRegistry([]));
    const result = await query.byId('nonexistent');
    assert.equal(result, null);
  });
});

describe('DSQLRuleQuery.categories', () => {
  it('returns unique sorted categories', async () => {
    const registry = makeRegistry([
      makeRule('rule-a', 'tokens', true),
      makeRule('rule-b', 'tokens', false),
      makeRule('rule-c', 'components', true),
    ]);
    const query = new DSQLRuleQuery(registry);
    const result = await query.categories();
    assert.deepEqual(result, ['components', 'tokens']);
  });

  it('returns empty array when registry is empty', async () => {
    const query = new DSQLRuleQuery(makeRegistry([]));
    const result = await query.categories();
    assert.equal(result.length, 0);
  });
});

describe('DSQLRuleQuery.fixable', () => {
  it('returns only enabled fixable rules', async () => {
    const registry = makeRegistry([
      makeRule('fixable-enabled', 'tokens', true, true),
      makeRule('fixable-disabled', 'tokens', false, true),
      makeRule('not-fixable', 'tokens', true, false),
    ]);
    const query = new DSQLRuleQuery(registry);
    const result = await query.fixable();
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, 'fixable-enabled');
  });
});
