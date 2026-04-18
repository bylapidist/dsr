import type {
  KWPFrame,
  KernelEvent,
  RankedToken,
  DeprecatedToken,
  DtifFlattenedToken,
  RuleDefinition,
  RuleSeverity,
  ComponentDefinition,
  EntropyScore,
  EntropyScoreComponents,
  DeprecationEntry,
  AgentEntry,
  AgentStats,
  PluginManifest,
  EntropyState,
} from './types.js';

/** Narrows `unknown` to an indexable record without any type assertion. */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Narrows `unknown` to a valid KWPFrame by structural check. */
export function isKWPFrame(v: unknown): v is KWPFrame {
  if (!isRecord(v)) return false;
  return typeof v.id === 'string' && typeof v.type === 'string';
}

/** Narrows `unknown` to `string | null`. */
export function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

/** Narrows `unknown` to a `string[]`. */
export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((e) => typeof e === 'string');
}

// ---------------------------------------------------------------------------
// DTIF / token type guards
// ---------------------------------------------------------------------------

export function isDtifFlattenedToken(v: unknown): v is DtifFlattenedToken {
  if (!isRecord(v)) return false;
  return typeof v.id === 'string' && typeof v.pointer === 'string';
}

export function isDtifFlattenedTokenOrNull(v: unknown): v is DtifFlattenedToken | null {
  return v === null || isDtifFlattenedToken(v);
}

export function isDtifFlattenedTokenArray(v: unknown): v is DtifFlattenedToken[] {
  return Array.isArray(v) && v.every(isDtifFlattenedToken);
}

// ---------------------------------------------------------------------------
// DSQL result type guards
// ---------------------------------------------------------------------------

export function isRankedToken(v: unknown): v is RankedToken {
  if (!isRecord(v)) return false;
  return isDtifFlattenedToken(v.token) && typeof v.confidence === 'number';
}

export function isRankedTokenArray(v: unknown): v is RankedToken[] {
  return Array.isArray(v) && v.every(isRankedToken);
}

export function isDeprecatedToken(v: unknown): v is DeprecatedToken {
  if (!isRecord(v)) return false;
  return isDtifFlattenedToken(v.token) && isRecord(v.entry);
}

export function isDeprecatedTokenArray(v: unknown): v is DeprecatedToken[] {
  return Array.isArray(v) && v.every(isDeprecatedToken);
}

// ---------------------------------------------------------------------------
// Rule type guards
// ---------------------------------------------------------------------------

const VALID_SEVERITIES = new Set(['error', 'warn', 'off']);

function isRuleSeverity(v: unknown): v is RuleSeverity {
  return typeof v === 'string' && VALID_SEVERITIES.has(v);
}

export function isPartialRuleDefinition(v: unknown): v is Partial<RuleDefinition> {
  if (!isRecord(v)) return false;
  if ('severity' in v && !isRuleSeverity(v.severity)) return false;
  if ('enabled' in v && typeof v.enabled !== 'boolean') return false;
  return true;
}

export function isRuleDefinition(v: unknown): v is RuleDefinition {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.category === 'string' &&
    typeof v.description === 'string' &&
    typeof v.enabled === 'boolean' &&
    isRuleSeverity(v.severity) &&
    typeof v.fixable === 'boolean'
  );
}

export function isRuleDefinitionOrNull(v: unknown): v is RuleDefinition | null {
  return v === null || isRuleDefinition(v);
}

export function isRuleDefinitionArray(v: unknown): v is RuleDefinition[] {
  return Array.isArray(v) && v.every(isRuleDefinition);
}

// ---------------------------------------------------------------------------
// Component type guards
// ---------------------------------------------------------------------------

export function isComponentDefinition(v: unknown): v is ComponentDefinition {
  if (!isRecord(v)) return false;
  return typeof v.name === 'string' && typeof v.package === 'string';
}

export function isComponentDefinitionOrNull(v: unknown): v is ComponentDefinition | null {
  return v === null || isComponentDefinition(v);
}

export function isComponentDefinitionArray(v: unknown): v is ComponentDefinition[] {
  return Array.isArray(v) && v.every(isComponentDefinition);
}

// ---------------------------------------------------------------------------
// Deprecation entry type guard
// ---------------------------------------------------------------------------

export function isDeprecationEntry(v: unknown): v is DeprecationEntry {
  if (!isRecord(v)) return false;
  return typeof v.pointer === 'string';
}

// ---------------------------------------------------------------------------
// Plugin manifest type guard
// ---------------------------------------------------------------------------

export function isPluginManifest(v: unknown): v is PluginManifest {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.version === 'string' &&
    Array.isArray(v.ruleIds) &&
    typeof v.path === 'string'
  );
}

// ---------------------------------------------------------------------------
// Agent type guards
// ---------------------------------------------------------------------------

function isAgentStats(v: unknown): v is AgentStats {
  if (!isRecord(v)) return false;
  return (
    typeof v.requests === 'number' &&
    typeof v.violations === 'number' &&
    typeof v.corrections === 'number'
  );
}

export function isAgentEntry(v: unknown): v is AgentEntry {
  if (!isRecord(v)) return false;
  return typeof v.id === 'string' && typeof v.connectedAt === 'string' && isAgentStats(v.stats);
}

// ---------------------------------------------------------------------------
// Entropy type guards
// ---------------------------------------------------------------------------

function isEntropyScoreComponents(v: unknown): v is EntropyScoreComponents {
  if (!isRecord(v)) return false;
  return (
    typeof v.tokenCoverageRatio === 'number' &&
    typeof v.violationRecurrenceRate === 'number' &&
    typeof v.agentAttributionRatio === 'number' &&
    typeof v.rateOfChange === 'number' &&
    typeof v.violationConcentration === 'number'
  );
}

export function isEntropyScore(v: unknown): v is EntropyScore {
  if (!isRecord(v)) return false;
  return (
    typeof v.overall === 'number' &&
    isEntropyScoreComponents(v.components) &&
    typeof v.measuredAt === 'string'
  );
}

export function isEntropyState(v: unknown): v is EntropyState {
  if (!isRecord(v)) return false;
  return isEntropyScore(v.current) && Array.isArray(v.history);
}

// ---------------------------------------------------------------------------
// KernelEvent type guard
// ---------------------------------------------------------------------------

function isKernelEventType(type: string): boolean {
  return (
    type === 'token.added' ||
    type === 'token.deprecated' ||
    type === 'token.removed' ||
    type === 'rule.configured' ||
    type === 'plugin.loaded' ||
    type === 'entropy.updated' ||
    type === 'snapshot.written'
  );
}

export function isKernelEvent(v: unknown): v is KernelEvent {
  if (!isRecord(v)) return false;
  return typeof v.type === 'string' && isKernelEventType(v.type);
}
