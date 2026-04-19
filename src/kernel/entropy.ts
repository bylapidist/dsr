/**
 * Kernel entropy calculation.
 *
 * Derives an `EntropyScore` from the live `KernelState`. The score is
 * recomputed after every write operation that mutates the token graph or
 * deprecation ledger so the kernel is always the authoritative source of
 * design-system health rather than relying on an external caller to push
 * a score in via `write.updateEntropy`.
 *
 * Score interpretation: 0–100 where 100 is a fully healthy system (no
 * deprecated tokens, high coverage, no churn) and 0 is fully entropic.
 */

import type { KernelState, EntropyScore, TokenType } from '../types.js';

/**
 * Compute the spread of deprecations across token types (Gini-like coefficient).
 * Returns 0 when all types are equally affected; 1 when all deprecations concentrate
 * on a single type.
 */
function computeViolationConcentration(state: KernelState): number {
  const { tokenGraph, deprecationLedger } = state;
  if (deprecationLedger.entries.size === 0) return 0;

  // Count deprecated tokens per type
  const countByType = new Map<string, number>();
  for (const [pointer] of deprecationLedger.entries) {
    const token = tokenGraph.tokens.get(pointer);
    const type = token?.type ?? 'unknown';
    countByType.set(type, (countByType.get(type) ?? 0) + 1);
  }

  const total = deprecationLedger.entries.size;
  if (total <= 1) return 0;

  const typeCount = countByType.size;
  if (typeCount === 1) return 1;

  // Normalised Herfindahl–Hirschman index: (Σ(share²) - 1/n) / (1 - 1/n)
  let sumSquares = 0;
  for (const count of countByType.values()) {
    const share = count / total;
    sumSquares += share * share;
  }
  const hhi = (sumSquares - 1 / typeCount) / (1 - 1 / typeCount);
  return Math.max(0, Math.min(1, hhi));
}

/**
 * Compute per-category entropy ratios (deprecated / total in that category).
 */
function computeByCategory(state: KernelState): Partial<Record<TokenType, number>> {
  const { tokenGraph, deprecationLedger } = state;
  const result: Partial<Record<TokenType, number>> = {};

  for (const [type, tokens] of tokenGraph.byType) {
    const total = tokens.length;
    if (total === 0) continue;
    const deprecated = tokens.filter((t) => deprecationLedger.entries.has(t.pointer)).length;
    result[type] = deprecated / total;
  }

  return result;
}

/**
 * Derive the rate-of-change from the entropy history.
 *
 * Returns the absolute delta in `overall` score between the most recent
 * and second-most-recent history entries, normalised to 0–1.
 */
function computeRateOfChange(history: readonly EntropyScore[]): number {
  if (history.length < 2) return 0;
  const prev = history[history.length - 2].overall;
  const curr = history[history.length - 1].overall;
  return Math.abs(curr - prev) / 100;
}

/**
 * Compute a fresh `EntropyScore` from the current `KernelState`.
 *
 * Called automatically by the kernel after every write mutation so the
 * score always reflects live state.
 */
export function computeEntropyScore(state: KernelState): EntropyScore {
  const { tokenGraph, deprecationLedger, agentRegistry, entropyState } = state;
  const totalTokens = tokenGraph.tokens.size;
  const deprecatedCount = deprecationLedger.entries.size;

  // tokenCoverageRatio: 1 when any tokens are loaded; 0 when the graph is empty
  const tokenCoverageRatio = totalTokens > 0 ? 1 : 0;

  // violationRecurrenceRate: fraction of tokens that are deprecated
  const violationRecurrenceRate = totalTokens > 0 ? deprecatedCount / totalTokens : 0;

  // agentAttributionRatio: 1 when at least one agent is registered
  const agentAttributionRatio = agentRegistry.agents.size > 0 ? 1 : 0;

  // rateOfChange: normalised delta between the two most recent history entries
  const rateOfChange = computeRateOfChange(entropyState.history);

  // violationConcentration: how concentrated deprecations are in one token type
  const violationConcentration = computeViolationConcentration(state);

  // overall (0–100): higher is healthier
  // Weights: deprecation coverage is the primary driver (50%), concentration (20%),
  // missing tokens (20%), churn (10%). Agent attribution is not penalised — it is
  // informational only.
  const penalty =
    violationRecurrenceRate * 0.5 +
    violationConcentration * 0.2 +
    (1 - tokenCoverageRatio) * 0.2 +
    rateOfChange * 0.1;

  const overall = Math.round(Math.max(0, Math.min(100, 100 * (1 - penalty))));

  return {
    overall,
    byCategory: computeByCategory(state),
    components: {
      tokenCoverageRatio,
      violationRecurrenceRate,
      agentAttributionRatio,
      rateOfChange,
      violationConcentration,
    },
    measuredAt: new Date().toISOString(),
  };
}
