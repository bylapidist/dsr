import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { writeSnapshot, readSnapshot } from '../../src/kernel/snapshot.js';
import { createInitialState, withSnapshotHash } from '../../src/kernel/state.js';
import type { DtifFlattenedToken, KernelState } from '../../src/types.js';

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

function makeTempPath(): string {
  return join(tmpdir(), `dsr-snapshot-test-${Date.now().toString()}.bin`);
}

describe('writeSnapshot / readSnapshot', () => {
  it('round-trips an empty initial state', async () => {
    const path = makeTempPath();
    try {
      const state = createInitialState();
      const hash = await writeSnapshot(state, path);
      assert.ok(hash.length > 0);

      const { state: restored, hash: restoredHash } = await readSnapshot(path);
      assert.equal(restoredHash, hash);
      assert.equal(restored.tokenGraph.tokens.size, 0);
      assert.equal(restored.ruleRegistry.rules.size, 0);
      assert.equal(restored.componentRegistry.components.size, 0);
      assert.equal(restored.deprecationLedger.entries.size, 0);
      assert.deepEqual(restored.pluginManifests, []);
    } finally {
      await rm(path, { force: true });
    }
  });

  it('preserves tokens across a round-trip', async () => {
    const path = makeTempPath();
    try {
      const token = makeToken('#/color/primary', 'color', '#3B82F6');
      const base = createInitialState();
      const state: KernelState = {
        ...base,
        tokenGraph: {
          tokens: new Map([['#/color/primary', token]]),
          byType: new Map([['color', [token]]]),
          sources: ['tokens.json'],
        },
      };

      await writeSnapshot(state, path);
      const { state: restored } = await readSnapshot(path);

      assert.equal(restored.tokenGraph.tokens.size, 1);
      const restoredToken = restored.tokenGraph.tokens.get('#/color/primary');
      assert.ok(restoredToken !== undefined);
      assert.equal(restoredToken.pointer, '#/color/primary');
      assert.equal(restoredToken.type, 'color');
    } finally {
      await rm(path, { force: true });
    }
  });

  it('preserves snapshotHash across a round-trip', async () => {
    const path = makeTempPath();
    try {
      const state = withSnapshotHash(createInitialState(), 'prev-hash-abc');
      await writeSnapshot(state, path);
      const { state: restored } = await readSnapshot(path);
      assert.equal(restored.snapshotHash, 'prev-hash-abc');
    } finally {
      await rm(path, { force: true });
    }
  });

  it('throws on a file with invalid magic bytes', async () => {
    const path = makeTempPath();
    try {
      const { writeFile } = await import('node:fs/promises');
      // Must be longer than MAGIC (8 bytes) + CHECKSUM_LENGTH (32 bytes) to pass the size check
      await writeFile(path, Buffer.alloc(50, 0x42)); // 50 bytes of 'B' — not 'DLRTv001'
      await assert.rejects(readSnapshot(path), /Invalid snapshot magic/);
    } finally {
      await rm(path, { force: true });
    }
  });

  it('throws on a file that is too short', async () => {
    const path = makeTempPath();
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(path, Buffer.from('short'));
      await assert.rejects(readSnapshot(path), /too short/);
    } finally {
      await rm(path, { force: true });
    }
  });

  it('throws on a file with corrupted checksum', async () => {
    const path = makeTempPath();
    try {
      const state = createInitialState();
      await writeSnapshot(state, path);

      const { readFile, writeFile } = await import('node:fs/promises');
      const buf = await readFile(path);
      // Flip the last byte of the checksum
      buf[buf.length - 1] = (buf[buf.length - 1] ?? 0) ^ 0xff;
      await writeFile(path, buf);

      await assert.rejects(readSnapshot(path), /checksum mismatch/);
    } finally {
      await rm(path, { force: true });
    }
  });
});
