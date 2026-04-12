import type { DtifFlattenedToken, TokenType } from '@lapidist/dtif-parser';

export type { DtifFlattenedToken, TokenType };

// ---------------------------------------------------------------------------
// Resolved design system graph
// ---------------------------------------------------------------------------

export interface ResolvedDtifGraph {
  /** All tokens indexed by their JSON pointer. */
  readonly tokens: ReadonlyMap<string, DtifFlattenedToken>;
  /** Tokens grouped by token type for O(1) type-filtered access. */
  readonly byType: ReadonlyMap<string, readonly DtifFlattenedToken[]>;
  /** Source URIs that contributed tokens to this graph. */
  readonly sources: readonly string[];
}

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

export type RuleSeverity = 'error' | 'warn' | 'off';

export interface RuleDefinition {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly severity: RuleSeverity;
  readonly options: unknown;
  readonly fixable: boolean;
  readonly stability: 'stable' | 'experimental' | 'deprecated';
}

export interface RuleRegistry {
  readonly rules: ReadonlyMap<string, RuleDefinition>;
}

// ---------------------------------------------------------------------------
// Component registry
// ---------------------------------------------------------------------------

export interface ComponentDefinition {
  readonly name: string;
  readonly package: string;
  readonly version?: string;
  readonly replaces?: readonly string[];
  readonly deprecated?: boolean;
  readonly replacedBy?: string;
}

export interface ComponentRegistry {
  readonly components: ReadonlyMap<string, ComponentDefinition>;
}

// ---------------------------------------------------------------------------
// Deprecation ledger
// ---------------------------------------------------------------------------

export interface DeprecationEntry {
  readonly pointer: string;
  readonly replacement?: string;
  readonly since?: string;
  readonly reason?: string;
}

export interface DeprecationLedger {
  readonly entries: ReadonlyMap<string, DeprecationEntry>;
}

// ---------------------------------------------------------------------------
// Plugin manifests
// ---------------------------------------------------------------------------

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly ruleIds: readonly string[];
  readonly path: string;
}

// ---------------------------------------------------------------------------
// Agent registry
// ---------------------------------------------------------------------------

export interface AgentStats {
  readonly requests: number;
  readonly violations: number;
  readonly corrections: number;
}

export interface AgentEntry {
  readonly id: string;
  readonly name?: string;
  readonly connectedAt: string;
  readonly stats: AgentStats;
}

export interface AgentRegistry {
  readonly agents: ReadonlyMap<string, AgentEntry>;
}

// ---------------------------------------------------------------------------
// Entropy
// ---------------------------------------------------------------------------

export interface EntropyScoreComponents {
  readonly tokenCoverageRatio: number;
  readonly violationRecurrenceRate: number;
  readonly agentAttributionRatio: number;
  readonly rateOfChange: number;
  readonly violationConcentration: number;
}

export interface EntropyScore {
  /** 0–100; lower means more entropic (worse design system health). */
  readonly overall: number;
  readonly byCategory: Partial<Record<TokenType, number>>;
  readonly byFile?: Record<string, number>;
  readonly components: EntropyScoreComponents;
  readonly measuredAt: string;
}

export interface EntropyState {
  readonly current: EntropyScore;
  readonly baseline?: EntropyScore;
  /** Most recent scores, newest last. Capped at 100 entries. */
  readonly history: readonly EntropyScore[];
}

// ---------------------------------------------------------------------------
// Kernel state
// ---------------------------------------------------------------------------

export interface KernelState {
  readonly tokenGraph: ResolvedDtifGraph;
  readonly ruleRegistry: RuleRegistry;
  readonly componentRegistry: ComponentRegistry;
  readonly deprecationLedger: DeprecationLedger;
  readonly pluginManifests: readonly PluginManifest[];
  readonly agentRegistry: AgentRegistry;
  readonly entropyState: EntropyState;
  readonly snapshotHash: string;
}

// ---------------------------------------------------------------------------
// Kernel Wire Protocol (KWP) frames
// ---------------------------------------------------------------------------

export type KWPFrameType = 'request' | 'response' | 'event' | 'error';

export interface KWPError {
  readonly code: string;
  readonly message: string;
}

export interface KWPFrame {
  readonly type: KWPFrameType;
  readonly id: string;
  readonly method?: string;
  readonly payload?: unknown;
  readonly error?: KWPError;
}

// ---------------------------------------------------------------------------
// Kernel events (pushed to all connected clients)
// ---------------------------------------------------------------------------

export type KernelEvent =
  | { readonly type: 'token.added'; readonly pointer: string; readonly token: DtifFlattenedToken }
  | { readonly type: 'token.deprecated'; readonly pointer: string; readonly replacement?: string }
  | { readonly type: 'token.removed'; readonly pointer: string }
  | { readonly type: 'rule.configured'; readonly ruleId: string; readonly options: unknown }
  | { readonly type: 'plugin.loaded'; readonly manifest: PluginManifest }
  | { readonly type: 'entropy.updated'; readonly score: EntropyScore }
  | { readonly type: 'snapshot.written'; readonly path: string; readonly hash: string };

// ---------------------------------------------------------------------------
// DSQL query result types
// ---------------------------------------------------------------------------

export type DistanceMetric = 'colour-delta-e' | 'numeric-proximity' | 'exact';

export interface RankedToken {
  readonly token: DtifFlattenedToken;
  readonly confidence: number;
  readonly distanceMetric: DistanceMetric;
}

export interface DeprecatedToken {
  readonly token: DtifFlattenedToken;
  readonly entry: DeprecationEntry;
}

// ---------------------------------------------------------------------------
// Kernel status
// ---------------------------------------------------------------------------

export type KernelStatus = 'running' | 'stopped' | 'starting' | 'stopping';

export interface KernelStatusReport {
  readonly status: KernelStatus;
  readonly pid?: number;
  readonly socketPath?: string;
  readonly httpPort?: number;
  readonly snapshotHash?: string;
  readonly uptimeMs?: number;
  readonly startedAt?: string;
}

// ---------------------------------------------------------------------------
// Transport interfaces
// ---------------------------------------------------------------------------

export type KWPFrameHandler = (frame: KWPFrame, reply: (frame: KWPFrame) => void) => Promise<void>;

export interface KernelTransport {
  start(handler: KWPFrameHandler): Promise<void>;
  stop(): Promise<void>;
  broadcast(frame: KWPFrame): void;
}

export interface TransportClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request(frame: KWPFrame): Promise<KWPFrame>;
  on(event: 'event', handler: (frame: KWPFrame) => void): void;
  off(event: 'event', handler: (frame: KWPFrame) => void): void;
}
