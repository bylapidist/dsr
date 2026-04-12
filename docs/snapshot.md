# Snapshot format

DSR snapshots are binary files that capture the full kernel state at a point in time.
They are used by `EdgeEnvironment` to restore the design system graph without starting
a live kernel process.

## Layout

```text
Offset    Length     Contents
------    ------     --------
0         8          Magic bytes: "DLRTv001" (ASCII)
8         N          MessagePack-encoded SnapshotPayload
8+N       32         SHA-256 checksum of bytes [0 .. 8+N-1]
```

The SHA-256 checksum covers both the magic bytes and the MessagePack payload.

## SnapshotPayload (MessagePack schema)

| Field | Type | Description |
|-------|------|-------------|
| `version` | `number` | Must be `1` |
| `createdAt` | `string` | ISO 8601 timestamp |
| `tokens` | `object` | Map of pointer → `DtifFlattenedToken` |
| `tokensByType` | `object` | Map of type → `DtifFlattenedToken[]` |
| `sources` | `string[]` | Source URIs that contributed tokens |
| `rules` | `object` | Map of ruleId → `RuleDefinition` |
| `components` | `object` | Map of name → `ComponentDefinition` |
| `deprecations` | `object` | Map of pointer → `DeprecationEntry` |
| `plugins` | `PluginManifest[]` | Loaded plugin manifests |
| `agents` | `object` | Map of agentId → `AgentEntry` |
| `entropyState` | `EntropyState` | Current entropy state and history |
| `snapshotHash` | `string` | Hash of the previous snapshot (empty string if none) |

## Reading a snapshot

```ts
import { EdgeEnvironment } from '@lapidist/dsr/environments/edge';

const env = new EdgeEnvironment();
await env.restore('./snapshot.bin');
```

`restore()` validates:

1. File is long enough to contain magic bytes + at least one byte of payload + checksum
2. The first 8 bytes equal `DLRTv001`
3. The SHA-256 checksum of `[magic + payload]` matches the stored checksum
4. The MessagePack payload decodes to a valid `SnapshotPayload` with `version === 1`

Any validation failure throws a descriptive error.

## Writing a snapshot

```ts
import { KernelProcess } from '@lapidist/dsr';

const kernel = new KernelProcess();
await kernel.start();

const hash = await kernel.exportSnapshot('./snapshot.bin');
console.log('Snapshot SHA-256:', hash);
```

`exportSnapshot()` writes the snapshot and emits a `snapshot.written` event. It also
updates the kernel's `snapshotHash` field so subsequent snapshots can reference the
previous one.

## Performance

The snapshot restore target is **< 50 ms** for a design system with up to 10,000 tokens.
MessagePack is chosen over JSON for its compact binary encoding and fast decode speed.
