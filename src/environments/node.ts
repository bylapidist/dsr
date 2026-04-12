import { UnixSocketClient, DEFAULT_SOCKET_PATH } from '../transport/unix-socket.js';
import { HttpClient, DEFAULT_HTTP_PORT } from '../transport/http.js';
import { DSQLClient } from '../dsql/client.js';
import type { KernelEvent, KWPFrame, TransportClient } from '../types.js';
import { isKernelEvent } from '../guards.js';

export interface NodeEnvironmentOptions {
  /** Path to the Unix domain socket. Defaults to /tmp/designlint-kernel.sock */
  socketPath?: string;
  /** Port for the HTTP fallback transport. Defaults to 7341. */
  httpPort?: number;
  /** Timeout in milliseconds for the initial connection attempt. Defaults to 5000. */
  connectTimeoutMs?: number;
}

/**
 * NodeEnvironment connects to a running DSR kernel from a Node.js process
 * (e.g. the design-lint CLI, LSP server, or MCP server).
 *
 * Connection strategy:
 *   1. Attempt Unix socket (low latency, same host)
 *   2. Fall back to HTTP if socket connection fails and httpPort is provided
 */
export class NodeEnvironment {
  readonly #options: Required<NodeEnvironmentOptions>;
  #transport: TransportClient | null = null;
  #dsql: DSQLClient | null = null;

  constructor(options: NodeEnvironmentOptions = {}) {
    this.#options = {
      socketPath: options.socketPath ?? DEFAULT_SOCKET_PATH,
      httpPort: options.httpPort ?? DEFAULT_HTTP_PORT,
      connectTimeoutMs: options.connectTimeoutMs ?? 5_000,
    };
  }

  async connect(): Promise<void> {
    const transport = await this.#tryConnect();
    this.#transport = transport;
    this.#dsql = new DSQLClient(transport);
  }

  async disconnect(): Promise<void> {
    if (this.#transport) {
      await this.#transport.disconnect();
      this.#transport = null;
      this.#dsql = null;
    }
  }

  get dsql(): DSQLClient {
    if (!this.#dsql) {
      throw new Error('NodeEnvironment is not connected. Call connect() first.');
    }
    return this.#dsql;
  }

  onEvent(handler: (event: KernelEvent) => void): () => void {
    const transport = this.#transport;
    if (!transport) {
      throw new Error('NodeEnvironment is not connected. Call connect() first.');
    }

    const frameHandler = (frame: KWPFrame): void => {
      if (isKernelEvent(frame.payload)) {
        handler(frame.payload);
      }
    };

    transport.on('event', frameHandler);
    return () => {
      transport.off('event', frameHandler);
    };
  }

  async #tryConnect(): Promise<TransportClient> {
    const socketClient = new UnixSocketClient(this.#options.socketPath);

    try {
      await withTimeout(socketClient.connect(), this.#options.connectTimeoutMs);
      return socketClient;
    } catch {
      // Unix socket unavailable — fall back to HTTP
    }

    const httpClient = new HttpClient(this.#options.httpPort);
    await withTimeout(httpClient.connect(), this.#options.connectTimeoutMs);
    return httpClient;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Connection timed out after ${ms.toString(10)}ms`));
      }, ms);
    }),
  ]);
}
