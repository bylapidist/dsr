/**
 * Tests for @lapidist/dsr KernelWriteAPI.
 *
 * The KernelWriteAPI wraps a TransportClient, so tests use a minimal
 * in-memory transport stub instead of a live kernel process.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KernelWriteAPI } from '../src/write-api/index.js';
import type {
  TransportClient,
  KWPFrame,
  DtifFlattenedToken,
  RuleDefinition,
  ComponentDefinition,
  DeprecationEntry,
  PluginManifest,
  EntropyScore,
} from '../src/types.js';

// ---------------------------------------------------------------------------
// Minimal in-memory transport stub
// ---------------------------------------------------------------------------

interface StubbedTransport extends TransportClient {
  lastFrame: KWPFrame | null;
  responsePayload: unknown;
}

function makeTransport(responsePayload: unknown = null): StubbedTransport {
  const stub: StubbedTransport = {
    lastFrame: null,
    responsePayload,
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    on: () => {
      /* no-op */
    },
    off: () => {
      /* no-op */
    },
    request(frame: KWPFrame): Promise<KWPFrame> {
      stub.lastFrame = frame;
      return Promise.resolve({
        type: 'response',
        id: frame.id,
        payload: stub.responsePayload,
      });
    },
  };
  return stub;
}

function makeToken(pointer: string): DtifFlattenedToken {
  return {
    id: pointer,
    pointer,
    name: pointer.replace(/^#\//, '').replaceAll('/', '.'),
    path: pointer.replace(/^#\//, '').split('/'),
    type: 'color',
    value: '#000000',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KernelWriteAPI', () => {
  it('addToken sends a write.addToken request with pointer and token', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    const token = makeToken('#/color/primary');
    await api.addToken('#/color/primary', token);

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'write.addToken');
    const payload = transport.lastFrame.payload as { pointer: string };
    assert.equal(payload.pointer, '#/color/primary');
  });

  it('deprecateToken sends a write.deprecateToken request', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    await api.deprecateToken('#/color/old', '#/color/new');

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'write.deprecateToken');
    const payload = transport.lastFrame.payload as {
      pointer: string;
      replacement?: string;
    };
    assert.equal(payload.pointer, '#/color/old');
    assert.equal(payload.replacement, '#/color/new');
  });

  it('deprecateToken accepts no replacement argument', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    await api.deprecateToken('#/color/old');

    assert.ok(transport.lastFrame !== null);
    const payload = transport.lastFrame.payload as { replacement?: string };
    assert.equal(payload.replacement, undefined);
  });

  it('removeToken sends a write.removeToken request', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    await api.removeToken('#/color/removed');

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'write.removeToken');
    const payload = transport.lastFrame.payload as { pointer: string };
    assert.equal(payload.pointer, '#/color/removed');
  });

  it('configureRule sends a write.configureRule request', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    const partial: Partial<RuleDefinition> = { severity: 'error' };
    await api.configureRule('design-token/colors', partial);

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'write.configureRule');
    const payload = transport.lastFrame.payload as {
      ruleId: string;
      partial: Partial<RuleDefinition>;
    };
    assert.equal(payload.ruleId, 'design-token/colors');
    assert.deepEqual(payload.partial, partial);
  });

  it('registerComponent sends a write.registerComponent request', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    const definition: ComponentDefinition = {
      name: 'Button',
      package: '@acme/ui',
    };
    await api.registerComponent('Button', definition);

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'write.registerComponent');
    const payload = transport.lastFrame.payload as {
      name: string;
      definition: ComponentDefinition;
    };
    assert.equal(payload.name, 'Button');
    assert.deepEqual(payload.definition, definition);
  });

  it('loadPlugin sends a write.loadPlugin request', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    const manifest: PluginManifest = {
      id: 'acme-my-plugin',
      name: '@acme/my-plugin',
      version: '1.0.0',
      ruleIds: ['acme/my-rule'],
      path: '/node_modules/@acme/my-plugin',
    };
    await api.loadPlugin(manifest);

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'write.loadPlugin');
    const payload = transport.lastFrame.payload as { manifest: PluginManifest };
    assert.deepEqual(payload.manifest, manifest);
  });

  it('recordDeprecationEntry sends a write.recordDeprecationEntry request', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    const entry: DeprecationEntry = {
      pointer: '#/color/old',
      replacement: '#/color/new',
      since: '2.0.0',
    };
    await api.recordDeprecationEntry(entry);

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'write.recordDeprecationEntry');
    const payload = transport.lastFrame.payload as {
      entry: DeprecationEntry;
    };
    assert.deepEqual(payload.entry, entry);
  });

  it('updateEntropy sends a write.updateEntropy request', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    const score: EntropyScore = {
      overall: 85,
      byCategory: {},
      measuredAt: new Date().toISOString(),
      components: {
        tokenCoverageRatio: 0.9,
        violationRecurrenceRate: 0.05,
        agentAttributionRatio: 0.1,
        rateOfChange: 0.02,
        violationConcentration: 0.15,
      },
    };
    await api.updateEntropy(score);

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'write.updateEntropy');
  });

  it('exportSnapshot sends a kernel.snapshot request and returns the hash', async () => {
    const transport = makeTransport('abc123hash');
    const api = new KernelWriteAPI(transport);
    const hash = await api.exportSnapshot('/tmp/snapshot.bin');

    assert.ok(transport.lastFrame !== null);
    assert.equal(transport.lastFrame.method, 'kernel.snapshot');
    const payload = transport.lastFrame.payload as { path: string };
    assert.equal(payload.path, '/tmp/snapshot.bin');
    assert.equal(hash, 'abc123hash');
  });

  it('exportSnapshot throws when response payload is not a string', async () => {
    const transport = makeTransport(42);
    const api = new KernelWriteAPI(transport);
    await assert.rejects(api.exportSnapshot('/tmp/snapshot.bin'), /Unexpected payload/);
  });

  it('each request uses a unique id', async () => {
    const transport = makeTransport();
    const api = new KernelWriteAPI(transport);
    const ids = new Set<string>();

    for (let i = 0; i < 5; i++) {
      await api.removeToken(`#/token/${i.toString()}`);
      if (transport.lastFrame) ids.add(transport.lastFrame.id);
    }

    assert.equal(ids.size, 5);
  });
});
