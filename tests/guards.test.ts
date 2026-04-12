import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRecord,
  isKWPFrame,
  isStringOrNull,
  isStringArray,
  isDtifFlattenedToken,
  isDtifFlattenedTokenOrNull,
  isDtifFlattenedTokenArray,
  isRankedToken,
  isRankedTokenArray,
  isDeprecatedToken,
  isDeprecatedTokenArray,
  isRuleDefinition,
  isRuleDefinitionOrNull,
  isRuleDefinitionArray,
  isComponentDefinition,
  isComponentDefinitionOrNull,
  isComponentDefinitionArray,
  isDeprecationEntry,
  isPluginManifest,
  isAgentEntry,
  isEntropyScore,
  isEntropyState,
  isKernelEvent,
} from '../src/guards.js';

const validToken = {
  id: 'tok-1',
  pointer: '#/color/primary',
  name: 'color.primary',
  path: ['color', 'primary'],
  type: 'color',
  value: '#3B82F6',
};

const validRule = {
  id: 'no-hardcoded-color',
  category: 'tokens',
  description: 'No hardcoded color values',
  enabled: true,
  severity: 'error',
  options: undefined,
  fixable: false,
  stability: 'stable',
};

const validEntropyComponents = {
  tokenCoverageRatio: 0.8,
  violationRecurrenceRate: 0.1,
  agentAttributionRatio: 0.5,
  rateOfChange: 0.2,
  violationConcentration: 0.3,
};

const validEntropyScore = {
  overall: 80,
  byCategory: {},
  components: validEntropyComponents,
  measuredAt: '2026-01-01T00:00:00.000Z',
};

describe('isRecord', () => {
  it('returns true for plain objects', () => {
    assert.ok(isRecord({}));
    assert.ok(isRecord({ a: 1 }));
  });

  it('returns false for null, arrays, primitives', () => {
    assert.ok(!isRecord(null));
    assert.ok(!isRecord([]));
    assert.ok(!isRecord('string'));
    assert.ok(!isRecord(42));
    assert.ok(!isRecord(undefined));
  });
});

describe('isKWPFrame', () => {
  it('returns true for valid frame', () => {
    assert.ok(isKWPFrame({ id: 'abc', type: 'request' }));
  });

  it('returns false when id or type is missing', () => {
    assert.ok(!isKWPFrame({ id: 'abc' }));
    assert.ok(!isKWPFrame({ type: 'request' }));
    assert.ok(!isKWPFrame(null));
  });
});

describe('isStringOrNull', () => {
  it('accepts strings and null', () => {
    assert.ok(isStringOrNull('hello'));
    assert.ok(isStringOrNull(null));
  });

  it('rejects other values', () => {
    assert.ok(!isStringOrNull(42));
    assert.ok(!isStringOrNull(undefined));
  });
});

describe('isStringArray', () => {
  it('accepts string arrays', () => {
    assert.ok(isStringArray([]));
    assert.ok(isStringArray(['a', 'b']));
  });

  it('rejects mixed or non-arrays', () => {
    assert.ok(!isStringArray([1, 'a']));
    assert.ok(!isStringArray('string'));
  });
});

describe('isDtifFlattenedToken', () => {
  it('accepts a valid token', () => {
    assert.ok(isDtifFlattenedToken(validToken));
  });

  it('rejects token without id or pointer', () => {
    assert.ok(!isDtifFlattenedToken({ pointer: '#/x' }));
    assert.ok(!isDtifFlattenedToken({ id: 'x' }));
    assert.ok(!isDtifFlattenedToken(null));
  });
});

describe('isDtifFlattenedTokenOrNull', () => {
  it('accepts null and valid tokens', () => {
    assert.ok(isDtifFlattenedTokenOrNull(null));
    assert.ok(isDtifFlattenedTokenOrNull(validToken));
  });

  it('rejects invalid values', () => {
    assert.ok(!isDtifFlattenedTokenOrNull('string'));
  });
});

describe('isDtifFlattenedTokenArray', () => {
  it('accepts arrays of valid tokens', () => {
    assert.ok(isDtifFlattenedTokenArray([validToken]));
    assert.ok(isDtifFlattenedTokenArray([]));
  });

  it('rejects arrays with invalid items', () => {
    assert.ok(!isDtifFlattenedTokenArray([{ id: 'x' }]));
  });
});

describe('isRankedToken', () => {
  it('accepts a valid ranked token', () => {
    assert.ok(isRankedToken({ token: validToken, confidence: 0.9, distanceMetric: 'exact' }));
  });

  it('rejects missing fields', () => {
    assert.ok(!isRankedToken({ token: validToken }));
    assert.ok(!isRankedToken({ confidence: 1 }));
    assert.ok(!isRankedToken(null));
  });
});

describe('isRankedTokenArray', () => {
  it('accepts arrays of valid ranked tokens', () => {
    assert.ok(isRankedTokenArray([{ token: validToken, confidence: 1, distanceMetric: 'exact' }]));
    assert.ok(isRankedTokenArray([]));
  });
});

describe('isDeprecatedToken', () => {
  it('accepts a valid deprecated token', () => {
    assert.ok(isDeprecatedToken({ token: validToken, entry: { pointer: '#/color/primary' } }));
  });

  it('rejects missing fields', () => {
    assert.ok(!isDeprecatedToken({ token: validToken }));
    assert.ok(!isDeprecatedToken(null));
  });
});

describe('isDeprecatedTokenArray', () => {
  it('accepts valid arrays', () => {
    assert.ok(isDeprecatedTokenArray([]));
    assert.ok(
      isDeprecatedTokenArray([{ token: validToken, entry: { pointer: '#/color/primary' } }]),
    );
  });
});

describe('isRuleDefinition', () => {
  it('accepts a valid rule definition', () => {
    assert.ok(isRuleDefinition(validRule));
  });

  it('rejects missing required fields', () => {
    assert.ok(!isRuleDefinition({ ...validRule, severity: 'invalid' }));
    assert.ok(!isRuleDefinition({ ...validRule, enabled: 'yes' }));
    assert.ok(!isRuleDefinition(null));
  });
});

describe('isRuleDefinitionOrNull', () => {
  it('accepts null and valid rule definitions', () => {
    assert.ok(isRuleDefinitionOrNull(null));
    assert.ok(isRuleDefinitionOrNull(validRule));
  });
});

describe('isRuleDefinitionArray', () => {
  it('accepts arrays of valid rule definitions', () => {
    assert.ok(isRuleDefinitionArray([validRule]));
    assert.ok(isRuleDefinitionArray([]));
  });
});

describe('isComponentDefinition', () => {
  it('accepts a valid component definition', () => {
    assert.ok(isComponentDefinition({ name: 'Button', package: '@acme/ui' }));
  });

  it('rejects missing fields', () => {
    assert.ok(!isComponentDefinition({ name: 'Button' }));
    assert.ok(!isComponentDefinition(null));
  });
});

describe('isComponentDefinitionOrNull', () => {
  it('accepts null and valid definitions', () => {
    assert.ok(isComponentDefinitionOrNull(null));
    assert.ok(isComponentDefinitionOrNull({ name: 'Button', package: '@acme/ui' }));
  });
});

describe('isComponentDefinitionArray', () => {
  it('accepts arrays of valid component definitions', () => {
    assert.ok(isComponentDefinitionArray([{ name: 'Button', package: '@acme/ui' }]));
    assert.ok(isComponentDefinitionArray([]));
  });
});

describe('isDeprecationEntry', () => {
  it('accepts a valid deprecation entry', () => {
    assert.ok(isDeprecationEntry({ pointer: '#/color/old' }));
    assert.ok(isDeprecationEntry({ pointer: '#/color/old', replacement: '#/color/new' }));
  });

  it('rejects entries without pointer', () => {
    assert.ok(!isDeprecationEntry({ replacement: '#/color/new' }));
    assert.ok(!isDeprecationEntry(null));
  });
});

describe('isPluginManifest', () => {
  it('accepts a valid plugin manifest', () => {
    assert.ok(
      isPluginManifest({
        id: 'my-plugin',
        name: 'My Plugin',
        version: '1.0.0',
        ruleIds: ['rule-a'],
        path: '/plugins/my-plugin.js',
      }),
    );
  });

  it('rejects missing fields', () => {
    assert.ok(!isPluginManifest({ id: 'x', name: 'X', version: '1.0.0' }));
    assert.ok(!isPluginManifest(null));
  });
});

describe('isAgentEntry', () => {
  it('accepts a valid agent entry', () => {
    assert.ok(
      isAgentEntry({
        id: 'agent-1',
        connectedAt: '2026-01-01T00:00:00.000Z',
        stats: { requests: 0, violations: 0, corrections: 0 },
      }),
    );
  });

  it('rejects missing fields', () => {
    assert.ok(!isAgentEntry({ id: 'agent-1', connectedAt: '2026-01-01T00:00:00.000Z' }));
    assert.ok(!isAgentEntry(null));
  });
});

describe('isEntropyScore', () => {
  it('accepts a valid entropy score', () => {
    assert.ok(isEntropyScore(validEntropyScore));
  });

  it('rejects missing fields', () => {
    assert.ok(!isEntropyScore({ overall: 80 }));
    assert.ok(!isEntropyScore(null));
  });
});

describe('isEntropyState', () => {
  it('accepts a valid entropy state', () => {
    assert.ok(isEntropyState({ current: validEntropyScore, history: [] }));
    assert.ok(isEntropyState({ current: validEntropyScore, history: [validEntropyScore] }));
  });

  it('rejects invalid entropy state', () => {
    assert.ok(!isEntropyState({ current: {}, history: [] }));
    assert.ok(!isEntropyState(null));
  });
});

describe('isKernelEvent', () => {
  it('accepts all known event types', () => {
    assert.ok(isKernelEvent({ type: 'token.added', pointer: '#/x', token: validToken }));
    assert.ok(isKernelEvent({ type: 'token.deprecated', pointer: '#/x' }));
    assert.ok(isKernelEvent({ type: 'token.removed', pointer: '#/x' }));
    assert.ok(isKernelEvent({ type: 'rule.configured', ruleId: 'r', options: {} }));
    assert.ok(
      isKernelEvent({
        type: 'plugin.loaded',
        manifest: {
          id: 'p',
          name: 'P',
          version: '1',
          ruleIds: [],
          path: '/p.js',
        },
      }),
    );
    assert.ok(isKernelEvent({ type: 'entropy.updated', score: validEntropyScore }));
    assert.ok(isKernelEvent({ type: 'snapshot.written', path: '/x.bin', hash: 'abc' }));
  });

  it('rejects unknown event types and non-objects', () => {
    assert.ok(!isKernelEvent({ type: 'unknown.event' }));
    assert.ok(!isKernelEvent(null));
    assert.ok(!isKernelEvent('string'));
  });
});
