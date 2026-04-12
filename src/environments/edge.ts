import { readSnapshot } from '../kernel/snapshot.js';
import { DSQLExecutor } from '../dsql/executor.js';
import type { KernelState } from '../types.js';

export interface EdgeEnvironmentOptions {
  /** Path to the binary snapshot file. */
  snapshotPath: string;
}

/**
 * EdgeEnvironment restores kernel state from a binary snapshot.
 * Intended for serverless / edge runtimes where a persistent kernel process
 * cannot run. Queries execute entirely in-memory; writes are not supported.
 *
 * Snapshot restore target: < 50ms.
 */
export class EdgeEnvironment {
  readonly #snapshotPath: string;
  #state: KernelState | null = null;
  #executor: DSQLExecutor | null = null;

  constructor(options: EdgeEnvironmentOptions) {
    this.#snapshotPath = options.snapshotPath;
  }

  /**
   * Restores the kernel state from the snapshot file.
   * Must be called before accessing dsql.
   */
  async restore(): Promise<void> {
    const { state } = await readSnapshot(this.#snapshotPath);
    this.#state = state;
    this.#executor = new DSQLExecutor(state);
  }

  get dsql(): DSQLExecutor {
    if (!this.#executor) {
      throw new Error('EdgeEnvironment has not been restored. Call restore() first.');
    }
    return this.#executor;
  }

  get snapshotHash(): string {
    return this.#state?.snapshotHash ?? '';
  }
}
