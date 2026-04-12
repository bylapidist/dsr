# NodeEnvironment

`NodeEnvironment` connects to a running DSR kernel from a Node.js process — for example
a design-lint CLI, LSP server, or MCP server running on the same host.

## Connection strategy

1. Attempt Unix domain socket (low latency, same host)
2. Fall back to HTTP if the socket connection fails or times out

## Usage

```ts
import { NodeEnvironment } from '@lapidist/dsr/environments/node';

const env = new NodeEnvironment({
  socketPath: '/tmp/designlint-kernel.sock', // default
  httpPort: 7341,                            // default
  connectTimeoutMs: 5000,                    // default
});

await env.connect();

// Access the DSQL client
const rules = await env.dsql.rules().enabled();

// Subscribe to kernel events
const unsubscribe = env.onEvent((event) => {
  if (event.type === 'token.added') {
    console.log('New token:', event.pointer);
  }
});

await env.disconnect();
unsubscribe();
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `socketPath` | `string` | `/tmp/designlint-kernel.sock` | Path to the Unix domain socket |
| `httpPort` | `number` | `7341` | HTTP fallback port |
| `connectTimeoutMs` | `number` | `5000` | Timeout for the initial connection attempt |

## API

### `connect(): Promise<void>`

Connects to the kernel. Tries the Unix socket first, falls back to HTTP on failure.
Throws if both transports fail within `connectTimeoutMs`.

### `disconnect(): Promise<void>`

Closes the transport connection.

### `get dsql: DSQLClient`

Returns the [DSQL client](/dsql). Throws if not connected.

### `onEvent(handler): () => void`

Registers a handler for kernel push events. Returns an unsubscribe function.
Throws if not connected.
