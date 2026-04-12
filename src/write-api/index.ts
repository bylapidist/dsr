import type {
  DtifFlattenedToken,
  RuleDefinition,
  ComponentDefinition,
  DeprecationEntry,
  PluginManifest,
  EntropyScore,
  TransportClient,
  KWPFrame,
} from '../types.js';
import { isStringOrNull } from '../guards.js';

/**
 * KernelWriteAPI sends write operations to the kernel process over the transport.
 * All mutations are applied by the kernel and broadcast as KernelEvents to
 * all connected clients.
 */
export class KernelWriteAPI {
  readonly #transport: TransportClient;

  constructor(transport: TransportClient) {
    this.#transport = transport;
  }

  addToken(pointer: string, token: DtifFlattenedToken): Promise<void> {
    return this.#voidRequest('write.addToken', { pointer, token });
  }

  deprecateToken(pointer: string, replacement?: string): Promise<void> {
    return this.#voidRequest('write.deprecateToken', { pointer, replacement });
  }

  removeToken(pointer: string): Promise<void> {
    return this.#voidRequest('write.removeToken', { pointer });
  }

  configureRule(ruleId: string, partial: Partial<RuleDefinition>): Promise<void> {
    return this.#voidRequest('write.configureRule', { ruleId, partial });
  }

  registerComponent(name: string, definition: ComponentDefinition): Promise<void> {
    return this.#voidRequest('write.registerComponent', { name, definition });
  }

  loadPlugin(manifest: PluginManifest): Promise<void> {
    return this.#voidRequest('write.loadPlugin', { manifest });
  }

  recordDeprecationEntry(entry: DeprecationEntry): Promise<void> {
    return this.#voidRequest('write.recordDeprecationEntry', { entry });
  }

  updateEntropy(score: EntropyScore): Promise<void> {
    return this.#voidRequest('write.updateEntropy', { score });
  }

  async exportSnapshot(path: string): Promise<string> {
    const res = await this.#request('kernel.snapshot', { path });
    if (!isStringOrNull(res.payload) || res.payload === null) {
      throw new Error('Unexpected payload for kernel.snapshot');
    }
    return res.payload;
  }

  async #voidRequest(method: string, params: Record<string, unknown>): Promise<void> {
    await this.#request(method, params);
  }

  #request(method: string, params: Record<string, unknown>): Promise<KWPFrame> {
    return this.#transport.request({
      type: 'request',
      id: crypto.randomUUID(),
      method,
      payload: params,
    });
  }
}
