/**
 * Tests for @lapidist/dsr environment adapters.
 *
 * - EdgeEnvironment: restore from snapshot, dsql queries, snapshotHash
 * - NodeEnvironment: connection fallback, error on unconnected access
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { EdgeEnvironment } from '../src/environments/edge.js';
import { NodeEnvironment } from '../src/environments/node.js';
import { writeSnapshot } from '../src/kernel/snapshot.js';
import { createInitialState, withTokenGraph, withSnapshotHash } from '../src/kernel/state.js';
import { UnixSocketTransport, DEFAULT_SOCKET_PATH } from '../src/transport/unix-socket.js';
import { HttpTransport } from '../src/transport/http.js';
import type { KWPFrame, DtifFlattenedToken } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempPath(): string {
  return join(
    tmpdir(),
    `dsr-env-test-${Date.now().toString()}-${Math.random().toString(36).slice(2)}.bin`,
  );
}

function makeSocketPath(): string {
  return join(
    tmpdir(),
    `dsr-env-test-${Date.now().toString()}-${Math.random().toString(36).slice(2)}.sock`,
  );
}

function makePort(): number {
  return 41000 + Math.floor(Math.random() * 8999);
}

function makeToken(pointer: string, type: string, value: unknown): DtifFlattenedToken {
  return {
    id: pointer,
    pointer,
    name: pointer.replace(/^#\//, '').replaceAll('/', '.'),
    path: pointer.replace(/^#\//, '').split('/'),
    type,
    value: value as DtifFlattenedToken['value'],
  };
}

function pongHandler(frame: KWPFrame, reply: (f: KWPFrame) => void): Promise<void> {
  reply({ type: 'response', id: frame.id, payload: { pong: true } });
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// EdgeEnvironment
// ---------------------------------------------------------------------------

describe('EdgeEnvironment', () => {
  it('restores an empty initial state from a snapshot', async () => {
    const snapshotPath = makeTempPath();
    try {
      await writeSnapshot(createInitialState(), snapshotPath);
      const env = new EdgeEnvironment({ snapshotPath });
      await env.restore();
      const tokenList = await env.dsql.tokens().all();
      assert.equal(tokenList.length, 0);
    } finally {
      await rm(snapshotPath, { force: true });
    }
  });

  it('exposes the snapshotHash from the restored state', async () => {
    const snapshotPath = makeTempPath();
    try {
      const state = withSnapshotHash(createInitialState(), 'abc123def');
      await writeSnapshot(state, snapshotPath);
      const env = new EdgeEnvironment({ snapshotPath });
      await env.restore();
      assert.equal(env.snapshotHash, 'abc123def');
    } finally {
      await rm(snapshotPath, { force: true });
    }
  });

  it('returns empty snapshotHash before restore', () => {
    const env = new EdgeEnvironment({ snapshotPath: '/nonexistent' });
    assert.equal(env.snapshotHash, '');
  });

  it('throws when dsql is accessed before restore', () => {
    const env = new EdgeEnvironment({ snapshotPath: '/nonexistent' });
    assert.throws(() => env.dsql, /restore\(\)/);
  });

  it('provides dsql access to tokens in the snapshot', async () => {
    const snapshotPath = makeTempPath();
    try {
      const token = makeToken('#/color/brand', 'color', '#3B82F6');
      const base = createInitialState();
      const state = withTokenGraph(base, {
        tokens: new Map([['#/color/brand', token]]),
        byType: new Map([['color', [token]]]),
        sources: ['tokens.json'],
      });
      await writeSnapshot(state, snapshotPath);

      const env = new EdgeEnvironment({ snapshotPath });
      await env.restore();

      const found = await env.dsql.tokens().byPointer('#/color/brand');
      assert.ok(found !== null);
      assert.equal(found.pointer, '#/color/brand');
      assert.equal(found.type, 'color');
    } finally {
      await rm(snapshotPath, { force: true });
    }
  });

  it('restores and queries tokens by type', async () => {
    const snapshotPath = makeTempPath();
    try {
      const color = makeToken('#/color/primary', 'color', '#EF4444');
      const spacing = makeToken('#/spacing/4', 'dimension', '16px');
      const base = createInitialState();
      const state = withTokenGraph(base, {
        tokens: new Map([
          ['#/color/primary', color],
          ['#/spacing/4', spacing],
        ]),
        byType: new Map([
          ['color', [color]],
          ['dimension', [spacing]],
        ]),
        sources: ['tokens.json'],
      });
      await writeSnapshot(state, snapshotPath);

      const env = new EdgeEnvironment({ snapshotPath });
      await env.restore();

      const colorTokens = await env.dsql.tokens('color').all();
      assert.equal(colorTokens.length, 1);
      assert.equal(colorTokens[0]?.pointer, '#/color/primary');
    } finally {
      await rm(snapshotPath, { force: true });
    }
  });

  it('throws on restore when snapshot file does not exist', async () => {
    const env = new EdgeEnvironment({ snapshotPath: '/no/such/file.bin' });
    await assert.rejects(env.restore());
  });
});

// ---------------------------------------------------------------------------
// NodeEnvironment
// ---------------------------------------------------------------------------

describe('NodeEnvironment', () => {
  it('throws when dsql is accessed before connect', () => {
    const env = new NodeEnvironment({
      socketPath: DEFAULT_SOCKET_PATH,
      connectTimeoutMs: 10,
    });
    assert.throws(() => env.dsql, /connect\(\)/);
  });

  it('throws when onEvent is called before connect', () => {
    const env = new NodeEnvironment({
      socketPath: DEFAULT_SOCKET_PATH,
      connectTimeoutMs: 10,
    });
    assert.throws(
      () =>
        env.onEvent(() => {
          /* handler */
        }),
      /connect\(\)/,
    );
  });

  it('connects to a Unix socket transport and provides dsql', async () => {
    const socketPath = makeSocketPath();
    const transport = new UnixSocketTransport(socketPath);
    const env = new NodeEnvironment({
      socketPath,
      connectTimeoutMs: 2000,
    });
    try {
      await transport.start(pongHandler);
      await env.connect();
      // If dsql is accessible, the connection succeeded
      assert.ok(typeof env.dsql.tokens === 'function');
    } finally {
      await env.disconnect();
      await transport.stop();
      await rm(socketPath, { force: true });
    }
  });

  it('falls back to HTTP when Unix socket is unavailable', async () => {
    const port = makePort();
    const transport = new HttpTransport(port);
    // Use a socket path that does not exist so Unix connection fails immediately
    const nonexistentSocket = makeSocketPath();
    const env = new NodeEnvironment({
      socketPath: nonexistentSocket,
      httpPort: port,
      connectTimeoutMs: 2000,
    });
    try {
      await transport.start(pongHandler);
      await env.connect();
      assert.ok(typeof env.dsql.tokens === 'function');
    } finally {
      await env.disconnect();
      await transport.stop();
    }
  });

  it('throws when neither Unix socket nor HTTP are available', async () => {
    const env = new NodeEnvironment({
      socketPath: makeSocketPath(),
      httpPort: makePort(),
      connectTimeoutMs: 100,
    });
    await assert.rejects(env.connect());
  });

  it('disconnect is a no-op when not connected', async () => {
    const env = new NodeEnvironment({ connectTimeoutMs: 10 });
    await env.disconnect(); // should not throw
  });

  it('onEvent registers and can be unsubscribed', async () => {
    const socketPath = makeSocketPath();
    const transport = new UnixSocketTransport(socketPath);
    const env = new NodeEnvironment({ socketPath, connectTimeoutMs: 2000 });
    try {
      await transport.start(pongHandler);
      await env.connect();

      const events: unknown[] = [];
      const off = env.onEvent((event) => {
        events.push(event);
      });
      assert.equal(typeof off, 'function');
      off(); // unsubscribe without error
    } finally {
      await env.disconnect();
      await transport.stop();
      await rm(socketPath, { force: true });
    }
  });
});
