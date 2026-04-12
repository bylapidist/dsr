# Kernel Wire Protocol (KWP)

The Kernel Wire Protocol is the IPC format used between the kernel daemon and its clients.

## Transports

| Transport | Default | Use case |
|-----------|---------|----------|
| Unix domain socket | `/tmp/designlint-kernel.sock` | Primary; same-host Node.js clients |
| HTTP + SSE | Port `7341` | Browser clients; cross-machine access |

## Frame format (Unix socket)

Frames over the Unix socket are length-prefixed MessagePack:

```text
[ 4-byte uint32BE length ][ MessagePack-encoded KWPFrame ]
```

The length field counts only the MessagePack payload bytes, not itself.

## Frame format (HTTP)

- **POST `/kwp`** — request/response for DSQL queries and write operations
- **GET `/kwp/events`** — SSE stream for kernel push events
- **GET `/kwp/status`** — kernel status endpoint (plain JSON)

HTTP frames are JSON-encoded `KWPFrame` objects.

## KWPFrame

```ts
interface KWPFrame {
  readonly type: 'request' | 'response' | 'event' | 'error';
  readonly id: string;           // UUID v4
  readonly method?: string;      // e.g. 'dsql.tokens.closest'
  readonly payload?: unknown;    // method params or response data
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}
```

## Methods

### DSQL queries (read-only)

| Method | Parameters | Returns |
|--------|-----------|---------|
| `dsql.tokens.closest` | `rawValue`, `property`, `type?` | `RankedToken[]` |
| `dsql.tokens.forProperty` | `cssProperty`, `type?` | `DtifFlattenedToken[]` |
| `dsql.tokens.byPointer` | `pointer` | `DtifFlattenedToken \| null` |
| `dsql.tokens.deprecated` | `type?` | `DeprecatedToken[]` |
| `dsql.tokens.withReplacement` | `pointer` | `string \| null` |
| `dsql.rules.all` | `category?` | `RuleDefinition[]` |
| `dsql.rules.enabled` | `category?` | `RuleDefinition[]` |
| `dsql.rules.byId` | `ruleId` | `RuleDefinition \| null` |
| `dsql.rules.categories` | — | `string[]` |
| `dsql.rules.fixable` | `category?` | `RuleDefinition[]` |
| `dsql.components.all` | — | `ComponentDefinition[]` |
| `dsql.components.byName` | `name` | `ComponentDefinition \| null` |
| `dsql.components.byPackage` | `packageName` | `ComponentDefinition[]` |
| `dsql.components.deprecated` | — | `ComponentDefinition[]` |
| `dsql.entropy` | — | `EntropyState` |

### Write operations

| Method | Parameters |
|--------|-----------|
| `write.addToken` | `pointer`, `token` |
| `write.deprecateToken` | `pointer`, `replacement?` |
| `write.removeToken` | `pointer` |
| `write.configureRule` | `ruleId`, `partial` |
| `write.registerComponent` | `name`, `definition` |
| `write.loadPlugin` | `manifest` |
| `write.recordDeprecationEntry` | `entry` |
| `write.updateEntropy` | `score` |
| `kernel.snapshot` | `path` |
| `kernel.status` | — |

## Error codes

| Code | Description |
|------|-------------|
| `UNKNOWN_METHOD` | The requested method is not recognised by the kernel |
