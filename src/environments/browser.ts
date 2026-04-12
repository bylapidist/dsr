import { HttpClient, DEFAULT_HTTP_PORT } from '../transport/http.js';
import { DSQLClient } from '../dsql/client.js';
import type { KernelEvent, KWPFrame } from '../types.js';
import { isKernelEvent } from '../guards.js';

export interface BrowserEnvironmentOptions {
  /** Port the kernel HTTP transport is listening on. Defaults to 7341. */
  httpPort?: number;
}

/**
 * BrowserEnvironment connects to a running DSR kernel from a browser context
 * (e.g. an online IDE or web-based design tool) via the HTTP fallback transport.
 *
 * Uses SSE (Server-Sent Events) for kernel push events when EventSource is
 * available in the browser.
 */
export class BrowserEnvironment {
  readonly #client: HttpClient;
  #dsql: DSQLClient | null = null;

  constructor(options: BrowserEnvironmentOptions = {}) {
    this.#client = new HttpClient(options.httpPort ?? DEFAULT_HTTP_PORT);
  }

  async connect(): Promise<void> {
    await this.#client.connect();
    this.#dsql = new DSQLClient(this.#client);
  }

  async disconnect(): Promise<void> {
    await this.#client.disconnect();
    this.#dsql = null;
  }

  get dsql(): DSQLClient {
    if (!this.#dsql) {
      throw new Error('BrowserEnvironment is not connected. Call connect() first.');
    }
    return this.#dsql;
  }

  onEvent(handler: (event: KernelEvent) => void): () => void {
    const frameHandler = (frame: KWPFrame): void => {
      if (isKernelEvent(frame.payload)) {
        handler(frame.payload);
      }
    };

    this.#client.on('event', frameHandler);
    return () => {
      this.#client.off('event', frameHandler);
    };
  }
}
