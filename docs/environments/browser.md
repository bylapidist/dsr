# BrowserEnvironment

`BrowserEnvironment` connects to a running DSR kernel from a browser context — for
example an online IDE, web-based design tool, or Figma plugin.

It uses HTTP for request/response and SSE (Server-Sent Events) for kernel push events
when `EventSource` is available.

## Usage

```ts
import { BrowserEnvironment } from '@lapidist/dsr/environments/browser';

const env = new BrowserEnvironment({ httpPort: 7341 });

await env.connect();

// Query tokens
const colors = await env.dsql.tokens('color').forProperty('color');

// Subscribe to push events
const unsubscribe = env.onEvent((event) => {
  console.log('Kernel event:', event.type);
});

await env.disconnect();
unsubscribe();
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `httpPort` | `number` | `7341` | Port the kernel HTTP transport is listening on |

## API

### `connect(): Promise<void>`

Performs a health check against the kernel HTTP endpoint and initialises the SSE stream.

### `disconnect(): Promise<void>`

Closes the HTTP client and SSE connection.

### `get dsql: DSQLClient`

Returns the [DSQL client](/dsql). Throws if not connected.

### `onEvent(handler): () => void`

Registers a handler for kernel push events delivered over SSE.

## CORS

The kernel HTTP transport does not configure CORS headers by default. When connecting
from a browser origin different from `localhost`, configure a reverse proxy to add the
appropriate headers.
