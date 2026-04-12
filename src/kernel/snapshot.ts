import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pack, unpack } from 'msgpackr';
import type {
  KernelState,
  ResolvedDtifGraph,
  RuleRegistry,
  ComponentRegistry,
  DeprecationLedger,
  AgentRegistry,
  DtifFlattenedToken,
} from '../types.js';
import {
  isRecord,
  isDtifFlattenedToken,
  isRuleDefinition,
  isComponentDefinition,
  isDeprecationEntry,
  isPluginManifest,
  isAgentEntry,
  isEntropyState,
} from '../guards.js';

/**
 * Binary snapshot format:
 *
 *   [0..7]   magic bytes  "DLRTv001" (8 bytes, ASCII)
 *   [8..N]   MessagePack-encoded SnapshotPayload
 *   [N+1..]  SHA-256 checksum of bytes [0..N] (32 bytes)
 *
 * Snapshot restore target: < 50ms.
 */

const MAGIC = Buffer.from('DLRTv001', 'ascii');
const CHECKSUM_LENGTH = 32;

interface SnapshotPayload {
  readonly version: number;
  readonly createdAt: string;
  readonly tokens: Record<PropertyKey, unknown>;
  readonly tokensByType: Record<PropertyKey, unknown>;
  readonly sources: unknown;
  readonly rules: Record<PropertyKey, unknown>;
  readonly components: Record<PropertyKey, unknown>;
  readonly deprecations: Record<PropertyKey, unknown>;
  readonly plugins: unknown[];
  readonly agents: Record<PropertyKey, unknown>;
  readonly entropyState: unknown;
  readonly snapshotHash: string;
}

function isSnapshotPayload(v: unknown): v is SnapshotPayload {
  if (!isRecord(v)) return false;
  return (
    typeof v.version === 'number' &&
    v.version === 1 &&
    typeof v.createdAt === 'string' &&
    isRecord(v.tokens) &&
    isRecord(v.tokensByType) &&
    isRecord(v.rules) &&
    isRecord(v.components) &&
    isRecord(v.deprecations) &&
    Array.isArray(v.plugins) &&
    isRecord(v.agents) &&
    typeof v.snapshotHash === 'string'
  );
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

function serializeGraph(
  graph: ResolvedDtifGraph,
): Pick<SnapshotPayload, 'tokens' | 'tokensByType' | 'sources'> {
  const tokens: Record<string, unknown> = {};
  for (const [k, v] of graph.tokens) tokens[k] = v;

  const tokensByType: Record<string, unknown[]> = {};
  for (const [k, v] of graph.byType) tokensByType[k] = [...v];

  return { tokens, tokensByType, sources: graph.sources };
}

function serializeMap<V>(map: ReadonlyMap<string, V>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of map) out[k] = v;
  return out;
}

function toPayload(state: KernelState): SnapshotPayload {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    ...serializeGraph(state.tokenGraph),
    rules: serializeMap(state.ruleRegistry.rules),
    components: serializeMap(state.componentRegistry.components),
    deprecations: serializeMap(state.deprecationLedger.entries),
    plugins: [...state.pluginManifests],
    agents: serializeMap(state.agentRegistry.agents),
    entropyState: state.entropyState,
    snapshotHash: state.snapshotHash,
  };
}

// ---------------------------------------------------------------------------
// Deserialisation helpers — fully type-safe, no type assertions
// ---------------------------------------------------------------------------

function parseTokenGraph(payload: SnapshotPayload): ResolvedDtifGraph {
  const tokenEntries = Object.entries(payload.tokens).filter(
    (entry): entry is [string, DtifFlattenedToken] => isDtifFlattenedToken(entry[1]),
  );

  const tokens: ReadonlyMap<string, DtifFlattenedToken> = new Map(tokenEntries);

  const byTypeEntries: [string, readonly DtifFlattenedToken[]][] = [];
  if (isRecord(payload.tokensByType)) {
    for (const [k, v] of Object.entries(payload.tokensByType)) {
      if (Array.isArray(v)) {
        const typed = v.filter(isDtifFlattenedToken);
        byTypeEntries.push([k, typed]);
      }
    }
  }

  const sources = Array.isArray(payload.sources)
    ? payload.sources.filter((s): s is string => typeof s === 'string')
    : [];

  return { tokens, byType: new Map(byTypeEntries), sources };
}

function parseRuleRegistry(payload: SnapshotPayload): RuleRegistry {
  const ruleEntries = Object.entries(payload.rules).filter(
    (
      entry,
    ): entry is [string, RuleRegistry['rules'] extends ReadonlyMap<string, infer V> ? V : never] =>
      isRuleDefinition(entry[1]),
  );
  return { rules: new Map(ruleEntries) };
}

function parseComponentRegistry(payload: SnapshotPayload): ComponentRegistry {
  const entries = Object.entries(payload.components).filter(
    (
      entry,
    ): entry is [
      string,
      ComponentRegistry['components'] extends ReadonlyMap<string, infer V> ? V : never,
    ] => isComponentDefinition(entry[1]),
  );
  return { components: new Map(entries) };
}

function parseDeprecationLedger(payload: SnapshotPayload): DeprecationLedger {
  const entries = Object.entries(payload.deprecations).filter(
    (
      entry,
    ): entry is [
      string,
      DeprecationLedger['entries'] extends ReadonlyMap<string, infer V> ? V : never,
    ] => isDeprecationEntry(entry[1]),
  );
  return { entries: new Map(entries) };
}

function parseAgentRegistry(payload: SnapshotPayload): AgentRegistry {
  const entries = Object.entries(payload.agents).filter(
    (
      entry,
    ): entry is [
      string,
      AgentRegistry['agents'] extends ReadonlyMap<string, infer V> ? V : never,
    ] => isAgentEntry(entry[1]),
  );
  return { agents: new Map(entries) };
}

function fromPayload(payload: SnapshotPayload): KernelState {
  const pluginManifests = payload.plugins.filter(isPluginManifest);

  const entropyState = isEntropyState(payload.entropyState)
    ? payload.entropyState
    : {
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

  return {
    tokenGraph: parseTokenGraph(payload),
    ruleRegistry: parseRuleRegistry(payload),
    componentRegistry: parseComponentRegistry(payload),
    deprecationLedger: parseDeprecationLedger(payload),
    pluginManifests,
    agentRegistry: parseAgentRegistry(payload),
    entropyState,
    snapshotHash: payload.snapshotHash,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function writeSnapshot(state: KernelState, outputPath: string): Promise<string> {
  const payload = toPayload(state);
  const packed = pack(payload);
  const body = Buffer.concat([MAGIC, packed]);
  const checksum = createHash('sha256').update(body).digest();
  const file = Buffer.concat([body, checksum]);

  const hash = checksum.toString('hex');
  await writeFile(outputPath, file);
  return hash;
}

export async function readSnapshot(
  inputPath: string,
): Promise<{ state: KernelState; hash: string }> {
  const file = await readFile(inputPath);

  if (file.length < MAGIC.length + CHECKSUM_LENGTH) {
    throw new Error('Snapshot file is too short to be valid');
  }

  const magic = file.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) {
    throw new Error(
      `Invalid snapshot magic: expected "DLRTv001", got "${magic.toString('ascii')}"`,
    );
  }

  const body = file.subarray(0, file.length - CHECKSUM_LENGTH);
  const storedChecksum = file.subarray(file.length - CHECKSUM_LENGTH);
  const computedChecksum = createHash('sha256').update(body).digest();

  if (!storedChecksum.equals(computedChecksum)) {
    throw new Error('Snapshot checksum mismatch — file may be corrupted');
  }

  const packed = file.subarray(MAGIC.length, file.length - CHECKSUM_LENGTH);
  const raw: unknown = unpack(packed);

  if (!isSnapshotPayload(raw)) {
    throw new Error('Snapshot payload failed validation — unsupported format or version');
  }

  const hash = storedChecksum.toString('hex');
  const state = fromPayload(raw);
  return { state, hash };
}
