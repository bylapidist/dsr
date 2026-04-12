# Architecture

## Overview

DSR is structured as a process-local kernel daemon with a typed IPC interface. All state
is held in a single immutable `KernelState` value that is replaced atomically on each
mutation.

```text
┌─────────────────────────────────────────────────┐
│                   KernelProcess                  │
│                                                  │
│  KernelState (immutable)                         │
│  ├── tokenGraph: ResolvedDtifGraph               │
│  ├── ruleRegistry: RuleRegistry                  │
│  ├── componentRegistry: ComponentRegistry        │
│  ├── deprecationLedger: DeprecationLedger        │
│  ├── pluginManifests: PluginManifest[]           │
│  ├── agentRegistry: AgentRegistry                │
│  ├── entropyState: EntropyState                  │
│  └── snapshotHash: string                        │
│                                                  │
│  KernelEventBus ──► broadcast to transports      │
│                                                  │
│  Transports                                      │
│  ├── UnixSocketTransport (primary)               │
│  └── HttpTransport (fallback + SSE)              │
└─────────────────────────────────────────────────┘
        │ KWP frames                ▲ KWP frames
        ▼                           │
┌───────────────┐         ┌─────────────────┐
│ NodeEnvironment│         │BrowserEnvironment│
│ (Unix → HTTP) │         │ (HTTP + SSE)    │
└───────────────┘         └─────────────────┘
        │
        ▼
┌───────────────┐
│ EdgeEnvironment│
│ (snapshot)    │
└───────────────┘
```

## State immutability

Every write operation replaces the entire `KernelState` value using a spread:

```ts
this.#state = { ...this.#state, tokenGraph: { ...current, tokens, byType } };
```

This means the kernel is free-threaded for reads (queries always see a consistent
snapshot of state) and serialisable for writes (one write at a time from the event loop).

## Dispatch loop

Incoming KWP frames are dispatched by `#dispatch()` in `KernelProcess`. DSQL query
methods are executed against a freshly constructed `DSQLExecutor` that closes over the
current state. Write methods mutate the state and emit events via the `KernelEventBus`.

## Event flow

```text
Write operation
      │
      ▼
KernelProcess.#state = newState
      │
      ▼
KernelEventBus.emit(event)
      │
      ▼
KernelProcess.#broadcastEvent(event)
      │
      ├──► UnixSocketTransport.broadcast(frame)  ──► all socket clients
      └──► HttpTransport.broadcast(frame)         ──► all SSE streams
```

## DSQL execution

```text
Client call: env.dsql.tokens('color').closest('#3B82F6', 'color')
      │
      ├── Local (DSQLExecutor): runs synchronously against KernelState
      │
      └── Remote (DSQLClient): sends 'dsql.tokens.closest' KWP request
                │
                ▼
          KernelProcess.#dispatch()
                │
                ▼
          DSQLExecutor.tokens('color').closest('#3B82F6', 'color')
                │
                ▼
          KWP response frame → DSQLClient → caller
```

## Module structure

```text
src/
├── types.ts              # All shared TypeScript interfaces
├── guards.ts             # Type predicates for runtime narrowing
├── index.ts              # Public API re-exports
├── kernel/
│   ├── index.ts          # KernelProcess
│   ├── state.ts          # Immutable state helpers
│   ├── event-bus.ts      # KernelEventBus
│   └── snapshot.ts       # Binary snapshot read/write
├── dsql/
│   ├── executor.ts       # Local DSQLExecutor
│   ├── client.ts         # Remote DSQLClient (over KWP)
│   ├── tokens.ts         # DSQLTokenQuery
│   ├── rules.ts          # DSQLRuleQuery
│   └── components.ts     # DSQLComponentQuery
├── transport/
│   ├── unix-socket.ts    # UnixSocketTransport + UnixSocketClient
│   └── http.ts           # HttpTransport + HttpClient
├── environments/
│   ├── node.ts           # NodeEnvironment
│   ├── browser.ts        # BrowserEnvironment
│   └── edge.ts           # EdgeEnvironment
└── write-api/
    └── index.ts          # KernelWriteAPI (remote write client)
```
