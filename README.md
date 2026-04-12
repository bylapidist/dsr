# @lapidist/dsr

**Design System Runtime** — a long-lived kernel process that holds the complete design system graph in memory and exposes it over a typed IPC interface.

Part of the [Lapidist](https://lapidist.net) ecosystem v8 architecture.

## Overview

DSR eliminates the cold-start cost of re-parsing DTIF and re-loading plugins on every CLI invocation. Every tool — linter, LSP, MCP server — connects to one running kernel instance via the Kernel Wire Protocol (KWP).

```sh
design-lint kernel start
design-lint kernel stop
design-lint kernel status
design-lint export-runtime-snapshot --out .designlint/snapshot.bin
```

## Architecture

```text
dsr/
├── kernel/        KernelProcess: lifecycle, state, event bus, snapshot
├── transport/     Unix socket (primary) + HTTP (fallback for Windows/CI)
├── dsql/          Design System Query Language: fluent in-memory query API
├── environments/  NodeEnvironment · BrowserEnvironment · EdgeEnvironment
└── write-api/     KernelWriteAPI: addToken, deprecateToken, configureRule…
```

## Performance targets

| Operation | Target |
|---|---|
| Kernel cold start | < 500ms |
| CLI on warm kernel | < 50ms |
| Snapshot restore | < 50ms |
| `lint_snippet` via MCP | < 50ms |
| LSP diagnostic on file change | < 100ms |
| 10k file workspace scan | < 10s |

## Installation

```sh
pnpm add @lapidist/dsr
```

## Usage

### Connect from Node.js (design-lint, LSP, MCP)

```ts
import { NodeEnvironment } from '@lapidist/dsr/environments/node';

const env = new NodeEnvironment();
await env.connect();

const tokens = await env.dsql.tokens('color').forProperty('color');
const ranked = await env.dsql.tokens().closest('#3B82F6', 'color');

await env.disconnect();
```

### Restore from snapshot (Edge / serverless)

```ts
import { EdgeEnvironment } from '@lapidist/dsr/environments/edge';

const env = new EdgeEnvironment({ snapshotPath: '.designlint/snapshot.bin' });
await env.restore();

const token = await env.dsql.tokens().byPointer('#/color/brand/primary');
```

### Run the kernel process

```ts
import { KernelProcess } from '@lapidist/dsr';

const kernel = new KernelProcess({ enableHttp: true });
await kernel.start();
// kernel is now listening on /tmp/designlint-kernel.sock and http://127.0.0.1:7341
```

## Dependency rules

DSR depends only on `@lapidist/dtif-parser`. It must never depend on `@lapidist/design-lint` or any downstream package.

## License

MIT — see [LICENSE](./LICENSE).
