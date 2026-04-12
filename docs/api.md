# API Reference

Complete type reference for `@lapidist/dsr`.

## KernelProcess

Main entry point for running the kernel daemon.

```ts
import { KernelProcess } from '@lapidist/dsr';
```

### Constructor

```ts
new KernelProcess(options?: KernelOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `socketPath` | `string` | `/tmp/designlint-kernel.sock` | Unix socket path |
| `httpPort` | `number` | `7341` | HTTP transport port |
| `enableHttp` | `boolean` | `true` | Whether to start the HTTP transport |
| `pidFile` | `string` | `/tmp/designlint-kernel.pid` | PID file location |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `start()` | `Promise<void>` | Starts transports, writes PID file, registers signal handlers |
| `stop()` | `Promise<void>` | Stops transports, removes PID file |
| `status()` | `KernelStatusReport` | Returns current kernel status |
| `exportSnapshot(path)` | `Promise<string>` | Writes snapshot, returns SHA-256 hash |
| `executor()` | `DSQLExecutor` | Returns a DSQL executor over current state |
| `addToken(pointer, token)` | `void` | |
| `deprecateToken(pointer, replacement?)` | `void` | |
| `removeToken(pointer)` | `void` | |
| `configureRule(ruleId, partial)` | `void` | |
| `registerComponent(name, definition)` | `void` | |
| `loadPlugin(manifest)` | `void` | |
| `recordDeprecationEntry(entry)` | `void` | |
| `updateEntropy(score)` | `void` | |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `KernelState` | Current immutable kernel state |
| `running` | `boolean` | Whether the kernel is running |

## Key interfaces

### KernelState

```ts
interface KernelState {
  readonly tokenGraph: ResolvedDtifGraph;
  readonly ruleRegistry: RuleRegistry;
  readonly componentRegistry: ComponentRegistry;
  readonly deprecationLedger: DeprecationLedger;
  readonly pluginManifests: readonly PluginManifest[];
  readonly agentRegistry: AgentRegistry;
  readonly entropyState: EntropyState;
  readonly snapshotHash: string;
}
```

### RuleDefinition

```ts
interface RuleDefinition {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly severity: 'error' | 'warn' | 'off';
  readonly options: unknown;
  readonly fixable: boolean;
  readonly stability: 'stable' | 'experimental' | 'deprecated';
}
```

### ComponentDefinition

```ts
interface ComponentDefinition {
  readonly name: string;
  readonly package: string;
  readonly version?: string;
  readonly replaces?: readonly string[];
  readonly deprecated?: boolean;
  readonly replacedBy?: string;
}
```

### DeprecationEntry

```ts
interface DeprecationEntry {
  readonly pointer: string;
  readonly replacement?: string;
  readonly since?: string;
  readonly reason?: string;
}
```

### EntropyScore

```ts
interface EntropyScore {
  /** 0–100; lower means more entropic (worse health) */
  readonly overall: number;
  readonly byCategory: Partial<Record<TokenType, number>>;
  readonly byFile?: Record<string, number>;
  readonly components: EntropyScoreComponents;
  readonly measuredAt: string;
}
```

### KernelEvent

A discriminated union of all event types broadcast by the kernel:

```ts
type KernelEvent =
  | { type: 'token.added'; pointer: string; token: DtifFlattenedToken }
  | { type: 'token.deprecated'; pointer: string; replacement?: string }
  | { type: 'token.removed'; pointer: string }
  | { type: 'rule.configured'; ruleId: string; options: unknown }
  | { type: 'plugin.loaded'; manifest: PluginManifest }
  | { type: 'entropy.updated'; score: EntropyScore }
  | { type: 'snapshot.written'; path: string; hash: string };
```

## Utility functions

### `getRunningKernelPid(pidFile?): Promise<number | null>`

Reads the PID file and checks whether the process is alive. Returns `null` if the file
does not exist, cannot be parsed, or the process is not running.

```ts
import { getRunningKernelPid } from '@lapidist/dsr';

const pid = await getRunningKernelPid();
if (pid !== null) {
  console.log('Kernel is running with PID', pid);
}
```
