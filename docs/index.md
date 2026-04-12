---
layout: home
title: "@lapidist/dsr"
titleTemplate: Design System Runtime for the Lapidist ecosystem
description: >-
  @lapidist/dsr is the long-lived kernel process that holds the complete design system
  graph in memory and exposes it to design-lint, MCP servers, LSP servers, and other
  tooling via a typed IPC interface.
hero:
  name: dsr
  text: Design System Runtime
  tagline: "A persistent kernel that serves your design system graph to every tool in your stack — tokens, rules, components, and entropy — over a fast local IPC transport."
  actions:
    - theme: brand
      text: Get started
      link: /introduction
    - theme: alt
      text: DSQL query API
      link: /dsql
    - theme: minimal
      text: Architecture
      link: /architecture
features:
  - icon: ⚡
    title: Sub-50 ms restore
    details: Binary snapshots with MessagePack encoding and SHA-256 integrity checks restore the full design system graph in under 50 ms.
  - icon: 🔌
    title: Three environments
    details: Connect from Node.js via Unix socket, from browsers via HTTP + SSE, or restore from a snapshot in edge or CI environments.
  - icon: 🔍
    title: DSQL — typed query API
    details: Fluent, in-memory query interface for tokens, rules, components, and entropy. Remote queries are dispatched transparently over the transport.
  - icon: 📡
    title: Kernel Wire Protocol
    details: Length-prefixed MessagePack frames over Unix domain socket with a JSON/SSE HTTP fallback — minimal overhead, zero dependencies on network infrastructure.
---

<!-- markdownlint-disable MD033 -->

<section class="home-section" aria-labelledby="what-is-dsr">

## What is DSR? {#what-is-dsr}

The Design System Runtime (DSR) is a long-lived Node.js daemon that holds the complete
design system graph in memory. It is the authoritative source of truth for:

- **Design tokens** — resolved DTIF token graph, indexed by pointer and by type
- **Rules** — configurable lint rules from design-lint and plugins
- **Components** — registered component definitions and their design system relationships
- **Deprecations** — token and component deprecation ledger with optional replacements
- **Entropy** — a rolling score measuring design system health over time

Tools such as design-lint, LSP servers, MCP servers, and CI scripts connect to the kernel
over the Kernel Wire Protocol (KWP) and use DSQL to query or mutate state. The kernel
broadcasts all mutations as typed events to all connected clients.

</section>

<section class="home-section" aria-labelledby="environments">

## Connect from any environment {#environments}

DSR ships three connection environments out of the box:

- **NodeEnvironment** — connects via Unix domain socket with automatic HTTP fallback.
  Used by design-lint CLI, LSP servers, and MCP servers running on the same host.
- **BrowserEnvironment** — connects via HTTP with optional SSE push events.
  Used by online IDEs and browser-based design tools.
- **EdgeEnvironment** — restores the kernel state from a binary snapshot without
  connecting to a live kernel. Used in CI pipelines, edge functions, and offline builds.

</section>

<section class="home-section" aria-labelledby="dsql">

## Query with DSQL {#dsql}

DSQL is a fluent, in-memory query API that speaks the same language whether the underlying
executor is local (in-process) or remote (over KWP):

```ts
import { NodeEnvironment } from '@lapidist/dsr/environments/node';

const env = new NodeEnvironment();
await env.connect();

// Find the closest token match for a raw CSS value
const matches = await env.dsql.tokens('color').closest('#3B82F6', 'color');

// List all enabled, fixable rules in the "tokens" category
const fixable = await env.dsql.rules('tokens').fixable();
```

</section>

<!-- markdownlint-enable MD033 -->
