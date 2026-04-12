# EdgeEnvironment

`EdgeEnvironment` restores the kernel state from a binary snapshot without connecting to
a live kernel process. It is read-only — write operations are not supported.

This environment is intended for:

- **CI pipelines** — lint against a frozen design system snapshot without starting a daemon
- **Edge functions** — serve DSQL queries in serverless contexts with sub-50 ms restore
- **Offline builds** — process design tokens without network access

## Usage

```ts
import { EdgeEnvironment } from '@lapidist/dsr/environments/edge';

const env = new EdgeEnvironment();
await env.restore('./snapshot.bin');

// Query against the restored state
const tokens = await env.dsql.tokens('color').forProperty('color');
const entropy = env.dsql.entropy();

console.log('Entropy score:', entropy.current.overall);
```

## API

### `restore(snapshotPath): Promise<void>`

Reads the snapshot from `snapshotPath`, validates the `DLRTv001` magic bytes and SHA-256
checksum, and restores the kernel state. Throws on any validation failure.

### `get dsql: DSQLExecutor`

Returns a [DSQL executor](/dsql) running directly against the restored state. Throws if
`restore()` has not been called.

## Snapshot format

See the [Snapshot format](/snapshot) reference for the binary layout, magic bytes, and
integrity checking specification.

## Write operations

`EdgeEnvironment` does not implement write operations. Attempting to mutate state through
`EdgeEnvironment` will throw at the call site. Use `NodeEnvironment` with a live kernel
for write operations.
