/**
 * Performance benchmark tests for @lapidist/dsr.
 *
 * Each test asserts a ROADMAP release gate time bound. A test failure means
 * the implementation has regressed past the required threshold — not that the
 * code is incorrect in a logical sense.
 *
 * Release gates covered here:
 *   - Kernel cold start < 500ms
 *   - Snapshot restore < 50ms
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { KernelProcess } from '../src/kernel/index.js';
import { writeSnapshot, readSnapshot } from '../src/kernel/snapshot.js';
import { createInitialState } from '../src/kernel/state.js';
import type { DtifFlattenedToken, KernelState } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

function makeOptions() {
  counter += 1;
  const id = `${Date.now().toString()}-${counter.toString()}`;
  return {
    socketPath: join(tmpdir(), `dsr-bench-${id}.sock`),
    pidFile: join(tmpdir(), `dsr-bench-${id}.pid`),
    enableHttp: false,
  };
}

function makeTempPath(): string {
  return join(tmpdir(), `dsr-bench-snapshot-${Date.now().toString()}.bin`);
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
// Release gate: Kernel cold start < 500ms
// ---------------------------------------------------------------------------

describe('Release gate: kernel cold start', () => {
  it('starts in under 500ms', async () => {
    const opts = makeOptions();
    const kernel = new KernelProcess(opts);
    const start = Date.now();
    try {
      await kernel.start();
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 500, `Kernel cold start took ${elapsed.toString()}ms — must be < 500ms`);
    } finally {
      await kernel.stop();
      await rm(opts.socketPath, { force: true });
      await rm(opts.pidFile, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Release gate: Snapshot restore < 50ms
// ---------------------------------------------------------------------------

describe('Release gate: snapshot restore', () => {
  it('reads a populated snapshot in under 50ms', async () => {
    // Build a non-trivial state with 500 tokens across multiple types
    const base = createInitialState();
    const types = ['color', 'spacing', 'font-size', 'border-radius', 'opacity'];
    const tokens = new Map<string, DtifFlattenedToken>();
    const byType = new Map<string, DtifFlattenedToken[]>();

    for (let i = 0; i < 500; i++) {
      const type = types[i % types.length] ?? 'color';
      const pointer = `#/${type}/token-${i.toString()}`;
      const token = makeToken(pointer, type, i);
      tokens.set(pointer, token);
      const bucket = byType.get(type) ?? [];
      bucket.push(token);
      byType.set(type, bucket);
    }

    const state: KernelState = {
      ...base,
      tokenGraph: {
        tokens,
        byType,
        sources: ['tokens.json'],
      },
    };

    const path = makeTempPath();
    try {
      // Write the snapshot (not timed — setup only)
      await writeSnapshot(state, path);

      // Time the restore
      const start = Date.now();
      const { state: restored } = await readSnapshot(path);
      const elapsed = Date.now() - start;

      assert.equal(restored.tokenGraph.tokens.size, 500);
      assert.ok(elapsed < 50, `Snapshot restore took ${elapsed.toString()}ms — must be < 50ms`);
    } finally {
      await rm(path, { force: true });
    }
  });
});
