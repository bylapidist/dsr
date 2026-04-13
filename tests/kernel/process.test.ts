/**
 * Tests for @lapidist/dsr KernelProcess.
 *
 * KernelProcess manages the full kernel lifecycle: transports, state mutations,
 * KWP dispatch, event emission, and snapshot export. Tests use an ephemeral
 * socket path and PID file to avoid interfering with a running kernel.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, readFile } from 'node:fs/promises';
import { KernelProcess, getRunningKernelPid } from '../../src/kernel/index.js';
import { UnixSocketClient } from '../../src/transport/unix-socket.js';
import type {
  DtifFlattenedToken,
  ComponentDefinition,
  PluginManifest,
  EntropyScore,
  KernelEvent,
} from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

function makeOptions() {
  counter += 1;
  const id = `${Date.now().toString()}-${counter.toString()}`;
  return {
    socketPath: join(tmpdir(), `dsr-kernel-test-${id}.sock`),
    pidFile: join(tmpdir(), `dsr-kernel-test-${id}.pid`),
    enableHttp: false,
  };
}

function makeToken(pointer: string, type = 'color', value: unknown = '#000'): DtifFlattenedToken {
  return {
    id: pointer,
    pointer,
    name: pointer.replace(/^#\//, '').replaceAll('/', '.'),
    path: pointer.replace(/^#\//, '').split('/'),
    type,
    value: value as DtifFlattenedToken['value'],
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('KernelProcess lifecycle', () => {
  it('starts and reports running status', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    try {
      assert.equal(kernel.running, false);
      await kernel.start();
      assert.equal(kernel.running, true);
      const report = kernel.status();
      assert.equal(report.status, 'running');
      assert.ok(typeof report.pid === 'number');
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('reports stopped status after stop', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.start();
    await kernel.stop();
    assert.equal(kernel.running, false);
    assert.equal(kernel.status().status, 'stopped');
    await rm(opts.socketPath, { force: true });
    await rm(opts.pidFile, { force: true });
  });

  it('throws when started twice', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    try {
      await kernel.start();
      await assert.rejects(kernel.start(), /already running/i);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('stop is a no-op when not running', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.stop(); // should not throw
  });

  it('writes a PID file on start', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    try {
      await kernel.start();
      const pidContent = await readFile(opts.pidFile, 'utf8');
      assert.equal(parseInt(pidContent.trim(), 10), process.pid);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('includes uptimeMs in status when running', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    try {
      await kernel.start();
      const report = kernel.status();
      assert.ok(typeof report.uptimeMs === 'number');
      assert.ok(report.uptimeMs >= 0);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// State mutations
// ---------------------------------------------------------------------------

describe('KernelProcess state mutations', () => {
  it('addToken adds a token to the kernel state', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.start();
    try {
      const token = makeToken('#/color/brand');
      kernel.addToken('#/color/brand', token);

      const state = kernel.state;
      assert.equal(state.tokenGraph.tokens.size, 1);
      assert.ok(state.tokenGraph.tokens.has('#/color/brand'));
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('addToken updates byType index', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.start();
    try {
      kernel.addToken('#/color/primary', makeToken('#/color/primary', 'color'));
      kernel.addToken('#/spacing/4', makeToken('#/spacing/4', 'dimension', '16px'));

      const colorGroup = kernel.state.tokenGraph.byType.get('color');
      assert.equal(colorGroup?.length, 1);
      const dimGroup = kernel.state.tokenGraph.byType.get('dimension');
      assert.equal(dimGroup?.length, 1);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('removeToken removes the token and cleans byType', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.start();
    try {
      kernel.addToken('#/color/brand', makeToken('#/color/brand', 'color'));
      kernel.removeToken('#/color/brand');

      assert.equal(kernel.state.tokenGraph.tokens.size, 0);
      const group = kernel.state.tokenGraph.byType.get('color');
      assert.equal(group?.length ?? 0, 0);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('deprecateToken adds an entry to the deprecation ledger', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.start();
    try {
      kernel.deprecateToken('#/color/old', '#/color/new');
      const entry = kernel.state.deprecationLedger.entries.get('#/color/old');
      assert.ok(entry !== undefined);
      assert.equal(entry.replacement, '#/color/new');
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('registerComponent adds a component to the registry', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.start();
    try {
      const def: ComponentDefinition = { name: 'Button', package: '@acme/ui' };
      kernel.registerComponent('Button', def);
      assert.ok(kernel.state.componentRegistry.components.has('Button'));
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('loadPlugin appends to pluginManifests', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.start();
    try {
      const manifest: PluginManifest = {
        id: 'acme-plugin',
        name: '@acme/plugin',
        version: '1.0.0',
        ruleIds: ['acme/rule'],
        path: '/node_modules/@acme/plugin',
      };
      kernel.loadPlugin(manifest);
      assert.equal(kernel.state.pluginManifests.length, 1);
      assert.equal(kernel.state.pluginManifests[0]?.id, 'acme-plugin');
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('updateEntropy updates the current entropy score', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    await kernel.start();
    try {
      const score: EntropyScore = {
        overall: 75,
        byCategory: {},
        measuredAt: new Date().toISOString(),
        components: {
          tokenCoverageRatio: 0.8,
          violationRecurrenceRate: 0.1,
          agentAttributionRatio: 0.2,
          rateOfChange: 0.05,
          violationConcentration: 0.15,
        },
      };
      kernel.updateEntropy(score);
      assert.equal(kernel.state.entropyState.current.overall, 75);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// KWP dispatch over transport
// ---------------------------------------------------------------------------

describe('KernelProcess KWP dispatch', () => {
  it('responds to kernel.status request', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    const client = new UnixSocketClient(opts.socketPath);
    try {
      await kernel.start();
      await client.connect();

      const response = await client.request({
        type: 'request',
        id: 'disp-001',
        method: 'kernel.status',
      });
      assert.equal(response.type, 'response');
      const payload = response.payload as { status: string };
      assert.equal(payload.status, 'running');
    } finally {
      await client.disconnect();
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('responds to dsql.tokens.byPointer request', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    const client = new UnixSocketClient(opts.socketPath);
    try {
      await kernel.start();
      kernel.addToken('#/color/primary', makeToken('#/color/primary'));
      await client.connect();

      const response = await client.request({
        type: 'request',
        id: 'disp-002',
        method: 'dsql.tokens.byPointer',
        payload: { pointer: '#/color/primary' },
      });
      assert.equal(response.type, 'response');
      const token = response.payload as { pointer: string } | null;
      assert.ok(token !== null);
      assert.equal(token.pointer, '#/color/primary');
    } finally {
      await client.disconnect();
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('returns null for dsql.tokens.byPointer with unknown pointer', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    const client = new UnixSocketClient(opts.socketPath);
    try {
      await kernel.start();
      await client.connect();

      const response = await client.request({
        type: 'request',
        id: 'disp-003',
        method: 'dsql.tokens.byPointer',
        payload: { pointer: '#/no/such/token' },
      });
      assert.equal(response.payload, null);
    } finally {
      await client.disconnect();
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('returns error frame for unknown method', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    const client = new UnixSocketClient(opts.socketPath);
    try {
      await kernel.start();
      await client.connect();

      await assert.rejects(
        client.request({
          type: 'request',
          id: 'disp-004',
          method: 'kernel.nonexistent',
        }),
        /UNKNOWN_METHOD/,
      );
    } finally {
      await client.disconnect();
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });

  it('dsql.entropy returns entropy score', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    const client = new UnixSocketClient(opts.socketPath);
    try {
      await kernel.start();
      await client.connect();

      const response = await client.request({
        type: 'request',
        id: 'disp-005',
        method: 'dsql.entropy',
      });
      assert.equal(response.type, 'response');
      const score = response.payload as { overall: number };
      assert.equal(typeof score.overall, 'number');
    } finally {
      await client.disconnect();
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

describe('KernelProcess event emission', () => {
  it('emits token.added event when addToken is called', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    const client = new UnixSocketClient(opts.socketPath);
    const events: KernelEvent[] = [];

    try {
      await kernel.start();
      await client.connect();
      client.on('event', (frame) => {
        const payload = frame.payload as KernelEvent;
        if (payload && typeof payload === 'object' && 'type' in payload) {
          events.push(payload);
        }
      });

      kernel.addToken('#/color/brand', makeToken('#/color/brand'));
      await new Promise<void>((resolve) => { setImmediate(resolve); });

      const added = events.find((e) => e.type === 'token.added');
      assert.ok(added !== undefined);
      assert.equal(added.type, 'token.added');
    } finally {
      await client.disconnect();
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Snapshot export
// ---------------------------------------------------------------------------

describe('KernelProcess exportSnapshot', () => {
  it('writes a snapshot and returns a hash', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    const snapshotPath = join(tmpdir(), `kernel-snap-${Date.now().toString()}.bin`);
    try {
      await kernel.start();
      const hash = await kernel.exportSnapshot(snapshotPath);
      assert.ok(hash.length > 0);
      assert.equal(kernel.state.snapshotHash, hash);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
      await rm(snapshotPath, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// getRunningKernelPid
// ---------------------------------------------------------------------------

describe('getRunningKernelPid', () => {
  it('returns null when the PID file does not exist', async () => {
    const pid = await getRunningKernelPid(join(tmpdir(), 'no-such-pid-file.pid'));
    assert.equal(pid, null);
  });

  it('returns the current PID when the kernel is running', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    try {
      await kernel.start();
      const pid = await getRunningKernelPid(opts.pidFile);
      assert.equal(pid, process.pid);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });
});
