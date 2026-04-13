/**
 * Tests for @lapidist/dsr transport layer.
 *
 * Covers both the Unix socket transport (primary IPC) and the HTTP fallback
 * transport. Each test brings up a server, connects a client, and verifies
 * round-trip KWP frame communication before tearing down.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { UnixSocketTransport, UnixSocketClient } from '../src/transport/unix-socket.js';
import { HttpTransport, HttpClient } from '../src/transport/http.js';
import type { KWPFrame } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSocketPath(): string {
  return join(
    tmpdir(),
    `dsr-test-${Date.now().toString()}-${Math.random().toString(36).slice(2)}.sock`,
  );
}

/** Pick an ephemeral port in the 40000–49999 range. */
function makePort(): number {
  return 40000 + Math.floor(Math.random() * 9999);
}

function echoHandler(frame: KWPFrame, reply: (f: KWPFrame) => void): Promise<void> {
  reply({ type: 'response', id: frame.id, payload: frame.payload });
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// UnixSocketTransport
// ---------------------------------------------------------------------------

describe('UnixSocketTransport', () => {
  it('starts and stops cleanly without error', async () => {
    const socketPath = makeSocketPath();
    const transport = new UnixSocketTransport(socketPath);
    await transport.start(echoHandler);
    await transport.stop();
    await rm(socketPath, { force: true });
  });

  it('exposes the socketPath it was constructed with', () => {
    const socketPath = makeSocketPath();
    const transport = new UnixSocketTransport(socketPath);
    assert.equal(transport.socketPath, socketPath);
  });

  it('round-trips a KWP request frame through a connected client', async () => {
    const socketPath = makeSocketPath();
    const transport = new UnixSocketTransport(socketPath);
    const client = new UnixSocketClient(socketPath);
    try {
      await transport.start(echoHandler);
      await client.connect();

      const frame: KWPFrame = {
        type: 'request',
        id: 'test-001',
        method: 'kernel.ping',
        payload: { hello: 'world' },
      };
      const response = await client.request(frame);

      assert.equal(response.type, 'response');
      assert.equal(response.id, 'test-001');
      assert.deepEqual(response.payload, { hello: 'world' });
    } finally {
      await client.disconnect();
      await transport.stop();
      await rm(socketPath, { force: true });
    }
  });

  it('broadcasts events to all connected clients', async () => {
    const socketPath = makeSocketPath();
    const transport = new UnixSocketTransport(socketPath);
    const clientA = new UnixSocketClient(socketPath);
    const clientB = new UnixSocketClient(socketPath);
    const receivedA: KWPFrame[] = [];
    const receivedB: KWPFrame[] = [];

    try {
      await transport.start(echoHandler);
      await clientA.connect();
      await clientB.connect();

      clientA.on('event', (frame) => {
        receivedA.push(frame);
      });
      clientB.on('event', (frame) => {
        receivedB.push(frame);
      });

      const event: KWPFrame = {
        type: 'event',
        id: 'evt-001',
        method: 'kernel.state.updated',
      };
      transport.broadcast(event);

      // Give the event loop a tick to deliver the buffers
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      assert.equal(receivedA.length, 1);
      assert.equal(receivedA[0]?.id, 'evt-001');
      assert.equal(receivedB.length, 1);
      assert.equal(receivedB[0]?.id, 'evt-001');
    } finally {
      await clientA.disconnect();
      await clientB.disconnect();
      await transport.stop();
      await rm(socketPath, { force: true });
    }
  });

  it('returns an error frame when the handler rejects', async () => {
    const socketPath = makeSocketPath();
    const failingHandler = (): Promise<void> => Promise.reject(new Error('handler exploded'));

    const transport = new UnixSocketTransport(socketPath);
    const client = new UnixSocketClient(socketPath);

    try {
      await transport.start(failingHandler);
      await client.connect();

      await assert.rejects(
        client.request({ type: 'request', id: 'err-001', method: 'bad' }),
        /handler exploded/,
      );
    } finally {
      await client.disconnect();
      await transport.stop();
      await rm(socketPath, { force: true });
    }
  });

  it('unsubscribed event handlers do not receive events', async () => {
    const socketPath = makeSocketPath();
    const transport = new UnixSocketTransport(socketPath);
    const client = new UnixSocketClient(socketPath);
    const received: KWPFrame[] = [];

    try {
      await transport.start(echoHandler);
      await client.connect();

      const handler = (frame: KWPFrame) => {
        received.push(frame);
      };
      client.on('event', handler);
      client.off('event', handler);

      transport.broadcast({ type: 'event', id: 'evt-002' });
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      assert.equal(received.length, 0);
    } finally {
      await client.disconnect();
      await transport.stop();
      await rm(socketPath, { force: true });
    }
  });

  it('throws when request is called before connect', async () => {
    const client = new UnixSocketClient(makeSocketPath());
    await assert.rejects(
      client.request({ type: 'request', id: 'not-connected', method: 'x' }),
      /Not connected/i,
    );
  });
});

// ---------------------------------------------------------------------------
// HttpTransport
// ---------------------------------------------------------------------------

describe('HttpTransport', () => {
  it('exposes the port it was constructed with', () => {
    const transport = new HttpTransport(12345);
    assert.equal(transport.port, 12345);
  });

  it('starts and stops cleanly without error', async () => {
    const port = makePort();
    const transport = new HttpTransport(port);
    await transport.start(echoHandler);
    await transport.stop();
  });

  it('round-trips a KWP request frame over HTTP POST', async () => {
    const port = makePort();
    const transport = new HttpTransport(port);
    const client = new HttpClient(port);
    try {
      await transport.start(echoHandler);
      await client.connect();

      const frame: KWPFrame = {
        type: 'request',
        id: 'http-001',
        method: 'kernel.ping',
        payload: { data: 42 },
      };
      const response = await client.request(frame);
      assert.equal(response.type, 'response');
      assert.equal(response.id, 'http-001');
      assert.deepEqual(response.payload, { data: 42 });
    } finally {
      await client.disconnect();
      await transport.stop();
    }
  });

  it('GET /kwp/status returns { status: "running" }', async () => {
    const port = makePort();
    const transport = new HttpTransport(port);
    try {
      await transport.start(echoHandler);
      const res = await fetch(`http://127.0.0.1:${port.toString()}/kwp/status`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { status: string };
      assert.equal(body.status, 'running');
    } finally {
      await transport.stop();
    }
  });

  it('returns 404 for unknown routes', async () => {
    const port = makePort();
    const transport = new HttpTransport(port);
    try {
      await transport.start(echoHandler);
      const res = await fetch(`http://127.0.0.1:${port.toString()}/unknown`);
      assert.equal(res.status, 404);
    } finally {
      await transport.stop();
    }
  });

  it('returns 400 for an invalid KWP frame body', async () => {
    const port = makePort();
    const transport = new HttpTransport(port);
    try {
      await transport.start(echoHandler);
      const res = await fetch(`http://127.0.0.1:${port.toString()}/kwp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ not: 'a kwp frame' }),
      });
      assert.equal(res.status, 400);
    } finally {
      await transport.stop();
    }
  });

  it('handles OPTIONS preflight with 204', async () => {
    const port = makePort();
    const transport = new HttpTransport(port);
    try {
      await transport.start(echoHandler);
      const res = await fetch(`http://127.0.0.1:${port.toString()}/kwp`, {
        method: 'OPTIONS',
      });
      assert.equal(res.status, 204);
    } finally {
      await transport.stop();
    }
  });

  it('returns 500 when handler rejects', async () => {
    const port = makePort();
    const failHandler = (): Promise<void> => Promise.reject(new Error('http handler exploded'));
    const transport = new HttpTransport(port);
    try {
      await transport.start(failHandler);
      const res = await fetch(`http://127.0.0.1:${port.toString()}/kwp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'request', id: 'fail-001', method: 'x' }),
      });
      assert.equal(res.status, 500);
    } finally {
      await transport.stop();
    }
  });

  it('client throws on request when server returns error frame', async () => {
    const port = makePort();
    const failHandler = (): Promise<void> => Promise.reject(new Error('http handler exploded'));
    const transport = new HttpTransport(port);
    const client = new HttpClient(port);
    try {
      await transport.start(failHandler);
      await client.connect();
      await assert.rejects(
        client.request({ type: 'request', id: 'fail-002', method: 'x' }),
        /http handler exploded/,
      );
    } finally {
      await client.disconnect();
      await transport.stop();
    }
  });
});
