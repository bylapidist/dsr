# Write API

The Write API mutates kernel state. All mutations are applied by the kernel and broadcast
as typed `KernelEvent`s to every connected client.

## Via the kernel directly

When running in-process with the kernel (e.g. in an integration or plugin):

```ts
import { KernelProcess } from '@lapidist/dsr';

const kernel = new KernelProcess();
await kernel.start();

kernel.addToken('#/color/primary', {
  id: 'color-primary',
  pointer: '#/color/primary',
  name: 'color.primary',
  path: ['color', 'primary'],
  type: 'color',
  value: '#3B82F6',
});
```

## Via KernelWriteAPI (remote)

When connecting from an external process over KWP:

```ts
import { KernelWriteAPI } from '@lapidist/dsr';
import { NodeEnvironment } from '@lapidist/dsr/environments/node';

// Connect and get a transport reference (internal implementation detail)
// The Write API is used by design-lint and other tooling that need to mutate kernel state
```

## Methods

### `addToken(pointer, token): Promise<void>`

Adds or replaces a token at the given JSON pointer. Emits `token.added`.

### `deprecateToken(pointer, replacement?): Promise<void>`

Marks a token as deprecated with an optional replacement pointer. Emits `token.deprecated`.

### `removeToken(pointer): Promise<void>`

Removes a token from the graph. Emits `token.removed`.

### `configureRule(ruleId, partial): Promise<void>`

Merges `partial` into the existing rule definition. Throws if the rule does not exist.
Emits `rule.configured`.

### `registerComponent(name, definition): Promise<void>`

Registers or replaces a component definition by name.

### `loadPlugin(manifest): Promise<void>`

Registers a plugin manifest. Emits `plugin.loaded`.

### `recordDeprecationEntry(entry): Promise<void>`

Records a deprecation entry in the ledger without emitting an event.

### `updateEntropy(score): Promise<void>`

Updates the entropy state with a new score. Appends the previous score to history
(capped at 100 entries). Emits `entropy.updated`.

### `exportSnapshot(path): Promise<string>`

Writes a binary snapshot to `path` and returns the SHA-256 hash. Emits `snapshot.written`.

## Kernel events

Every write operation (except `registerComponent` and `recordDeprecationEntry`) emits a
typed event broadcast to all connected clients:

| Event | Trigger |
|-------|---------|
| `token.added` | `addToken` |
| `token.deprecated` | `deprecateToken` |
| `token.removed` | `removeToken` |
| `rule.configured` | `configureRule` |
| `plugin.loaded` | `loadPlugin` |
| `entropy.updated` | `updateEntropy` |
| `snapshot.written` | `exportSnapshot` |
