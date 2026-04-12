import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  withTokenGraph,
  withSnapshotHash,
  withEntropyState,
} from '../../src/kernel/state.js';
import type { DtifFlattenedToken, ResolvedDtifGraph, EntropyState } from '../../src/types.js';

describe('createInitialState', () => {
  it('returns a state with empty registries', () => {
    const state = createInitialState();
    assert.equal(state.tokenGraph.tokens.size, 0);
    assert.equal(state.ruleRegistry.rules.size, 0);
    assert.equal(state.componentRegistry.components.size, 0);
    assert.equal(state.deprecationLedger.entries.size, 0);
    assert.deepEqual(state.pluginManifests, []);
    assert.equal(state.agentRegistry.agents.size, 0);
    assert.equal(state.snapshotHash, '');
  });

  it('sets initial entropy overall to 100', () => {
    const state = createInitialState();
    assert.equal(state.entropyState.current.overall, 100);
  });
});

describe('withTokenGraph', () => {
  it('replaces the token graph without mutating other state', () => {
    const state = createInitialState();
    const token: DtifFlattenedToken = {
      id: 'test-id',
      pointer: '#/color/primary',
      name: 'color.primary',
      path: ['color', 'primary'],
      type: 'color',
      value: '#3B82F6',
    };
    const newGraph: ResolvedDtifGraph = {
      tokens: new Map([['#/color/primary', token]]),
      byType: new Map([['color', [token]]]),
      sources: ['tokens.json'],
    };

    const updated = withTokenGraph(state, newGraph);

    assert.equal(updated.tokenGraph.tokens.size, 1);
    assert.equal(updated.tokenGraph.tokens.get('#/color/primary'), token);
    assert.equal(updated.ruleRegistry.rules.size, 0);
    assert.equal(updated.snapshotHash, '');

    // Original state is unmodified
    assert.equal(state.tokenGraph.tokens.size, 0);
  });
});

describe('withSnapshotHash', () => {
  it('sets the snapshot hash without mutating other state', () => {
    const state = createInitialState();
    const updated = withSnapshotHash(state, 'abc123');
    assert.equal(updated.snapshotHash, 'abc123');
    assert.equal(state.snapshotHash, '');
  });
});

describe('withEntropyState', () => {
  it('replaces entropy state without mutating other state', () => {
    const state = createInitialState();
    const newEntropy: EntropyState = {
      current: {
        overall: 72,
        byCategory: {},
        components: {
          tokenCoverageRatio: 0.7,
          violationRecurrenceRate: 0.2,
          agentAttributionRatio: 0.1,
          rateOfChange: 0.05,
          violationConcentration: 0.3,
        },
        measuredAt: '2026-01-01T00:00:00.000Z',
      },
      history: [],
    };

    const updated = withEntropyState(state, newEntropy);
    assert.equal(updated.entropyState.current.overall, 72);
    assert.equal(state.entropyState.current.overall, 100);
    assert.equal(updated.snapshotHash, '');
  });
});
