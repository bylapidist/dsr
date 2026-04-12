import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DSQLExecutor } from '../../src/dsql/executor.js';
import { createInitialState } from '../../src/kernel/state.js';

describe('DSQLExecutor', () => {
  it('tokens() returns a DSQLTokenQuery instance', () => {
    const executor = new DSQLExecutor(createInitialState());
    const query = executor.tokens();
    assert.ok(typeof query.byPointer === 'function');
    assert.ok(typeof query.forProperty === 'function');
    assert.ok(typeof query.closest === 'function');
    assert.ok(typeof query.deprecated === 'function');
    assert.ok(typeof query.withReplacement === 'function');
  });

  it('rules() returns a DSQLRuleQuery instance', () => {
    const executor = new DSQLExecutor(createInitialState());
    const query = executor.rules();
    assert.ok(typeof query.all === 'function');
    assert.ok(typeof query.enabled === 'function');
    assert.ok(typeof query.byId === 'function');
  });

  it('components() returns a DSQLComponentQuery instance', () => {
    const executor = new DSQLExecutor(createInitialState());
    const query = executor.components();
    assert.ok(typeof query.all === 'function');
    assert.ok(typeof query.byName === 'function');
  });

  it('entropy() returns the current entropy score', () => {
    const executor = new DSQLExecutor(createInitialState());
    const score = executor.entropy();
    assert.equal(score.overall, 100);
  });
});
