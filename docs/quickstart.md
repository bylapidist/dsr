# Quickstart

This guide shows how to start the DSR kernel, connect from a Node.js client, and run
your first DSQL query.

## 1. Start the kernel

The kernel daemon exposes a Unix socket at `/tmp/designlint-kernel.sock` by default and
an HTTP fallback on port 7341.

```ts
import { KernelProcess } from '@lapidist/dsr';

const kernel = new KernelProcess();
await kernel.start();

console.log('Kernel running:', kernel.status());
// { status: 'running', pid: 12345, socketPath: '/tmp/designlint-kernel.sock', ... }
```

To stop the kernel gracefully:

```ts
await kernel.stop();
```

## 2. Load tokens into the kernel

```ts
import type { DtifFlattenedToken } from '@lapidist/dsr';

const token: DtifFlattenedToken = {
  id: 'color-primary',
  pointer: '#/color/primary',
  name: 'color.primary',
  path: ['color', 'primary'],
  type: 'color',
  value: '#3B82F6',
};

kernel.addToken('#/color/primary', token);
```

The kernel broadcasts a `token.added` event to all connected clients immediately.

## 3. Connect a client

```ts
import { NodeEnvironment } from '@lapidist/dsr/environments/node';

const env = new NodeEnvironment();
await env.connect();

// Subscribe to kernel events
const unsubscribe = env.onEvent((event) => {
  console.log('Kernel event:', event.type);
});

// Query the design system
const matches = await env.dsql.tokens('color').closest('#3B82F6', 'color');
console.log('Closest token:', matches[0]?.token.pointer);
// '#/color/primary'

await env.disconnect();
unsubscribe();
```

## 4. Export a snapshot

Snapshots let `EdgeEnvironment` restore the kernel state without a live process:

```ts
// On the kernel side
const hash = await kernel.exportSnapshot('./snapshot.bin');
console.log('Snapshot written, hash:', hash);
```

```ts
// In CI or edge functions
import { EdgeEnvironment } from '@lapidist/dsr/environments/edge';

const env = new EdgeEnvironment();
await env.restore('./snapshot.bin');

const allTokens = await env.dsql.tokens().forProperty('color');
```

## Next steps

- [Detailed NodeEnvironment guide](/environments/node)
- [DSQL query API reference](/dsql)
- [Kernel Wire Protocol](/kwp)
