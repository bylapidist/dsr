import type {
  KernelState,
  ResolvedDtifGraph,
  RuleRegistry,
  ComponentRegistry,
  DeprecationLedger,
  AgentRegistry,
  EntropyState,
} from '../types.js';

function createEmptyGraph(): ResolvedDtifGraph {
  return {
    tokens: new Map(),
    byType: new Map(),
    sources: [],
  };
}

function createEmptyRuleRegistry(): RuleRegistry {
  return { rules: new Map() };
}

function createEmptyComponentRegistry(): ComponentRegistry {
  return { components: new Map() };
}

function createEmptyDeprecationLedger(): DeprecationLedger {
  return { entries: new Map() };
}

function createEmptyAgentRegistry(): AgentRegistry {
  return { agents: new Map() };
}

function createInitialEntropyState(): EntropyState {
  return {
    current: {
      overall: 100,
      byCategory: {},
      components: {
        tokenCoverageRatio: 1,
        violationRecurrenceRate: 0,
        agentAttributionRatio: 0,
        rateOfChange: 0,
        violationConcentration: 0,
      },
      measuredAt: new Date().toISOString(),
    },
    history: [],
  };
}

export function createInitialState(): KernelState {
  return {
    tokenGraph: createEmptyGraph(),
    ruleRegistry: createEmptyRuleRegistry(),
    componentRegistry: createEmptyComponentRegistry(),
    deprecationLedger: createEmptyDeprecationLedger(),
    pluginManifests: [],
    agentRegistry: createEmptyAgentRegistry(),
    entropyState: createInitialEntropyState(),
    snapshotHash: '',
  };
}

/**
 * Returns a new state with the token graph replaced.
 * All other state slices are carried forward unchanged.
 */
export function withTokenGraph(state: KernelState, tokenGraph: ResolvedDtifGraph): KernelState {
  return { ...state, tokenGraph };
}

export function withSnapshotHash(state: KernelState, snapshotHash: string): KernelState {
  return { ...state, snapshotHash };
}

export function withEntropyState(state: KernelState, entropyState: EntropyState): KernelState {
  return { ...state, entropyState };
}
