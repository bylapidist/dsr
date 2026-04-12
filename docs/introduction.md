# Introduction

`@lapidist/dsr` is the Design System Runtime — a long-lived Node.js kernel daemon that
holds the complete design system graph in memory and exposes it to every tool in your
stack through a fast local IPC transport.

## Why a kernel daemon?

Design system tooling — linters, language servers, AI assistants, CLI tools — all need
access to the same source of truth: which tokens exist, which rules are active, which
components are registered, and how healthy the design system is. Without a shared runtime,
each tool re-parses DTIF files independently, leading to:

- **Slow startup** — every tool pays the full parse cost on launch.
- **Stale data** — no way to observe changes without polling the filesystem.
- **Duplicated logic** — token resolution, rule configuration, and deprecation tracking
  are re-implemented in every tool.

DSR solves this by keeping the graph in memory and broadcasting typed events to all
connected clients when state changes.

## Core concepts

| Concept | Description |
|---------|-------------|
| **KWP** | Kernel Wire Protocol — MessagePack frames over Unix socket (JSON/HTTP fallback) |
| **DSQL** | Design System Query Language — fluent in-memory query API |
| **Snapshot** | Binary checkpoint: `DLRTv001` magic + MessagePack + SHA-256 trailer |
| **Entropy** | Rolling 0–100 score measuring design system health over time |
| **Kernel event** | Typed push notification broadcast to all clients on state change |

## Dependency position

DSR sits between the DTIF parser and the rest of the Lapidist toolchain:

```text
dtif → dsr → design-lint → design-lint-mcp
                          → design-lint-lsp
                          → design-lint-telemetry
```

DSR depends only on `@lapidist/dtif-parser`. It has no dependency on `design-lint`.

## Next steps

- [Install DSR and start the kernel](/installation)
- [Connect your first client with NodeEnvironment](/environments/node)
- [Explore the DSQL query API](/dsql)
