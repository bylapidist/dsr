import { existsSync, unlinkSync } from 'node:fs';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import type {
  KernelState,
  KWPFrame,
  KernelEvent,
  KernelStatusReport,
  PluginManifest,
  EntropyScore,
  DtifFlattenedToken,
  RuleDefinition,
  ComponentDefinition,
  DeprecationEntry,
} from '../types.js';
import {
  isRecord,
  isDtifFlattenedToken,
  isPartialRuleDefinition,
  isComponentDefinition,
  isDeprecationEntry,
  isPluginManifest,
  isEntropyScore,
} from '../guards.js';
import { createInitialState, withSnapshotHash, withEntropyState } from './state.js';
import { KernelEventBus } from './event-bus.js';
import { writeSnapshot } from './snapshot.js';
import { DSQLExecutor } from '../dsql/executor.js';
import { UnixSocketTransport, DEFAULT_SOCKET_PATH } from '../transport/unix-socket.js';
import { HttpTransport, DEFAULT_HTTP_PORT } from '../transport/http.js';

export interface KernelOptions {
  socketPath?: string;
  httpPort?: number;
  enableHttp?: boolean;
  pidFile?: string;
}

const DEFAULT_PID_FILE = '/tmp/designlint-kernel.pid';

/**
 * KernelProcess manages the full lifecycle of the DSR kernel daemon.
 *
 * Lifecycle:
 *   1. start() — loads initial state, starts transports, registers signal handlers
 *   2. Request frames arrive over transports → dispatched to DSQL executor / write API
 *   3. State mutations emit KernelEvents → broadcast to all clients
 *   4. stop() — graceful shutdown, removes socket and PID files
 */
export class KernelProcess {
  #state: KernelState;
  readonly #eventBus: KernelEventBus;
  readonly #unixTransport: UnixSocketTransport;
  readonly #httpTransport: HttpTransport | null;
  readonly #pidFile: string;
  #startedAt: Date | null = null;
  #running = false;

  constructor(options: KernelOptions = {}) {
    this.#state = createInitialState();
    this.#eventBus = new KernelEventBus();
    this.#unixTransport = new UnixSocketTransport(options.socketPath ?? DEFAULT_SOCKET_PATH);
    this.#httpTransport =
      options.enableHttp !== false
        ? new HttpTransport(options.httpPort ?? DEFAULT_HTTP_PORT)
        : null;
    this.#pidFile = options.pidFile ?? DEFAULT_PID_FILE;
  }

  get state(): KernelState {
    return this.#state;
  }

  get running(): boolean {
    return this.#running;
  }

  async start(): Promise<void> {
    if (this.#running) throw new Error('Kernel is already running');

    const socketPath = this.#unixTransport.socketPath;
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    this.#eventBus.on((event) => {
      this.#broadcastEvent(event);
    });

    await this.#unixTransport.start((frame, reply) => this.#dispatch(frame, reply));

    if (this.#httpTransport) {
      await this.#httpTransport.start((frame, reply) => this.#dispatch(frame, reply));
    }

    await writeFile(this.#pidFile, String(process.pid), 'utf8');

    this.#startedAt = new Date();
    this.#running = true;

    process.on('SIGTERM', () => {
      void this.stop();
    });
    process.on('SIGINT', () => {
      void this.stop();
    });
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;

    await this.#unixTransport.stop();

    if (this.#httpTransport) {
      await this.#httpTransport.stop();
    }

    this.#eventBus.removeAllListeners();

    await unlink(this.#pidFile).catch(() => {
      /* pid file may already be removed */
    });
  }

  status(): KernelStatusReport {
    return {
      status: this.#running ? 'running' : 'stopped',
      pid: this.#running ? process.pid : undefined,
      socketPath: this.#unixTransport.socketPath,
      httpPort: this.#httpTransport?.port,
      snapshotHash: this.#state.snapshotHash.length > 0 ? this.#state.snapshotHash : undefined,
      uptimeMs: this.#startedAt ? Date.now() - this.#startedAt.getTime() : undefined,
      startedAt: this.#startedAt?.toISOString(),
    };
  }

  async exportSnapshot(outputPath: string): Promise<string> {
    const hash = await writeSnapshot(this.#state, outputPath);
    this.#state = withSnapshotHash(this.#state, hash);
    this.#emitEvent({ type: 'snapshot.written', path: outputPath, hash });
    return hash;
  }

  executor(): DSQLExecutor {
    return new DSQLExecutor(this.#state);
  }

  // ---------------------------------------------------------------------------
  // Write API — methods that mutate kernel state
  // ---------------------------------------------------------------------------

  addToken(pointer: string, token: DtifFlattenedToken): void {
    const current = this.#state.tokenGraph;
    const tokens = new Map(current.tokens);
    tokens.set(pointer, token);

    const byType = new Map(current.byType);
    if (token.type) {
      const group = byType.get(token.type) ?? [];
      byType.set(token.type, [...group, token]);
    }

    this.#state = {
      ...this.#state,
      tokenGraph: { ...current, tokens, byType },
    };

    this.#emitEvent({ type: 'token.added', pointer, token });
  }

  deprecateToken(pointer: string, replacement?: string): void {
    const entries = new Map(this.#state.deprecationLedger.entries);
    entries.set(pointer, { pointer, replacement });
    this.#state = { ...this.#state, deprecationLedger: { entries } };
    this.#emitEvent({ type: 'token.deprecated', pointer, replacement });
  }

  removeToken(pointer: string): void {
    const current = this.#state.tokenGraph;
    const token = current.tokens.get(pointer);
    const tokens = new Map(current.tokens);
    tokens.delete(pointer);

    const byType = new Map(current.byType);
    if (token?.type) {
      const group = (byType.get(token.type) ?? []).filter((t) => t.pointer !== pointer);
      byType.set(token.type, group);
    }

    this.#state = { ...this.#state, tokenGraph: { ...current, tokens, byType } };
    this.#emitEvent({ type: 'token.removed', pointer });
  }

  configureRule(ruleId: string, partial: Partial<RuleDefinition>): void {
    const rules = new Map(this.#state.ruleRegistry.rules);
    const existing = rules.get(ruleId);
    if (!existing) throw new Error(`Unknown rule: ${ruleId}`);
    rules.set(ruleId, { ...existing, ...partial });
    this.#state = { ...this.#state, ruleRegistry: { rules } };
    this.#emitEvent({ type: 'rule.configured', ruleId, options: partial.options });
  }

  registerComponent(name: string, definition: ComponentDefinition): void {
    const components = new Map(this.#state.componentRegistry.components);
    components.set(name, definition);
    this.#state = { ...this.#state, componentRegistry: { components } };
  }

  loadPlugin(manifest: PluginManifest): void {
    const pluginManifests = [...this.#state.pluginManifests, manifest];
    this.#state = { ...this.#state, pluginManifests };
    this.#emitEvent({ type: 'plugin.loaded', manifest });
  }

  recordDeprecationEntry(entry: DeprecationEntry): void {
    const entries = new Map(this.#state.deprecationLedger.entries);
    entries.set(entry.pointer, entry);
    this.#state = { ...this.#state, deprecationLedger: { entries } };
  }

  updateEntropy(score: EntropyScore): void {
    const history = [...this.#state.entropyState.history, this.#state.entropyState.current].slice(
      -100,
    );
    this.#state = withEntropyState(this.#state, {
      current: score,
      baseline: this.#state.entropyState.baseline,
      history,
    });
    this.#emitEvent({ type: 'entropy.updated', score });
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  #emitEvent(event: KernelEvent): void {
    this.#eventBus.emit(event);
  }

  #broadcastEvent(event: KernelEvent): void {
    const frame = KernelEventBus.toKWPFrame(event);
    this.#broadcast(frame);
  }

  #broadcast(frame: KWPFrame): void {
    this.#unixTransport.broadcast(frame);
    this.#httpTransport?.broadcast(frame);
  }

  async #dispatch(frame: KWPFrame, reply: (frame: KWPFrame) => void): Promise<void> {
    const executor = this.executor();

    const respond = (payload: unknown): void => {
      reply({ type: 'response', id: frame.id, payload });
    };

    const method = frame.method ?? '';
    const params: Record<PropertyKey, unknown> = isRecord(frame.payload) ? frame.payload : {};

    const str = (key: string): string => {
      const v = params[key];
      return typeof v === 'string' ? v : '';
    };

    const optStr = (key: string): string | undefined => {
      const v = params[key];
      return typeof v === 'string' ? v : undefined;
    };

    switch (method) {
      case 'kernel.status':
        respond(this.status());
        break;

      case 'kernel.snapshot':
        respond(await this.exportSnapshot(str('path') || 'snapshot.bin'));
        break;

      case 'dsql.tokens.closest':
        respond(await executor.tokens(optStr('type')).closest(str('rawValue'), str('property')));
        break;

      case 'dsql.tokens.forProperty':
        respond(await executor.tokens(optStr('type')).forProperty(str('cssProperty')));
        break;

      case 'dsql.tokens.byPointer':
        respond(await executor.tokens().byPointer(str('pointer')));
        break;

      case 'dsql.tokens.deprecated':
        respond(await executor.tokens(optStr('type')).deprecated());
        break;

      case 'dsql.tokens.withReplacement':
        respond(await executor.tokens().withReplacement(str('pointer')));
        break;

      case 'dsql.rules.all':
        respond(await executor.rules(optStr('category')).all());
        break;

      case 'dsql.rules.enabled':
        respond(await executor.rules(optStr('category')).enabled());
        break;

      case 'dsql.rules.byId':
        respond(await executor.rules().byId(str('ruleId')));
        break;

      case 'dsql.rules.categories':
        respond(await executor.rules().categories());
        break;

      case 'dsql.rules.fixable':
        respond(await executor.rules(optStr('category')).fixable());
        break;

      case 'dsql.components.all':
        respond(await executor.components().all());
        break;

      case 'dsql.components.byName':
        respond(await executor.components().byName(str('name')));
        break;

      case 'dsql.components.byPackage':
        respond(await executor.components().byPackage(str('packageName')));
        break;

      case 'dsql.components.deprecated':
        respond(await executor.components().deprecated());
        break;

      case 'dsql.entropy':
        respond(executor.entropy());
        break;

      case 'write.addToken': {
        const token = params.token;
        if (!isDtifFlattenedToken(token)) {
          reply({
            type: 'error',
            id: frame.id,
            error: { code: 'INVALID_PARAMS', message: 'token must be a valid DtifFlattenedToken' },
          });
          break;
        }
        try {
          this.addToken(str('pointer'), token);
          respond(null);
        } catch (err) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'WRITE_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
        break;
      }

      case 'write.deprecateToken':
        try {
          this.deprecateToken(str('pointer'), optStr('replacement'));
          respond(null);
        } catch (err) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'WRITE_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
        break;

      case 'write.removeToken':
        try {
          this.removeToken(str('pointer'));
          respond(null);
        } catch (err) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'WRITE_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
        break;

      case 'write.configureRule': {
        const partial = params.partial;
        if (!isPartialRuleDefinition(partial)) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'INVALID_PARAMS',
              message: 'partial must be a valid partial RuleDefinition',
            },
          });
          break;
        }
        try {
          this.configureRule(str('ruleId'), partial);
          respond(null);
        } catch (err) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'WRITE_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
        break;
      }

      case 'write.registerComponent': {
        const definition = params.definition;
        if (!isComponentDefinition(definition)) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'INVALID_PARAMS',
              message: 'definition must be a valid ComponentDefinition',
            },
          });
          break;
        }
        try {
          this.registerComponent(str('name'), definition);
          respond(null);
        } catch (err) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'WRITE_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
        break;
      }

      case 'write.loadPlugin': {
        const manifest = params.manifest;
        if (!isPluginManifest(manifest)) {
          reply({
            type: 'error',
            id: frame.id,
            error: { code: 'INVALID_PARAMS', message: 'manifest must be a valid PluginManifest' },
          });
          break;
        }
        try {
          this.loadPlugin(manifest);
          respond(null);
        } catch (err) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'WRITE_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
        break;
      }

      case 'write.recordDeprecationEntry': {
        const entry = params.entry;
        if (!isDeprecationEntry(entry)) {
          reply({
            type: 'error',
            id: frame.id,
            error: { code: 'INVALID_PARAMS', message: 'entry must be a valid DeprecationEntry' },
          });
          break;
        }
        try {
          this.recordDeprecationEntry(entry);
          respond(null);
        } catch (err) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'WRITE_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
        break;
      }

      case 'write.updateEntropy': {
        const score = params.score;
        if (!isEntropyScore(score)) {
          reply({
            type: 'error',
            id: frame.id,
            error: { code: 'INVALID_PARAMS', message: 'score must be a valid EntropyScore' },
          });
          break;
        }
        try {
          this.updateEntropy(score);
          respond(null);
        } catch (err) {
          reply({
            type: 'error',
            id: frame.id,
            error: {
              code: 'WRITE_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
        break;
      }

      default:
        reply({
          type: 'error',
          id: frame.id,
          error: { code: 'UNKNOWN_METHOD', message: `Unknown method: ${method}` },
        });
    }
  }
}

// ---------------------------------------------------------------------------
// Static helpers for CLI integration
// ---------------------------------------------------------------------------

export async function getRunningKernelPid(pidFile = DEFAULT_PID_FILE): Promise<number | null> {
  try {
    const content = await readFile(pidFile, 'utf8');
    const pid = parseInt(content.trim(), 10);
    if (isNaN(pid)) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}
