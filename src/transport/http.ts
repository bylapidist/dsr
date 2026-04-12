import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import type { KernelTransport, TransportClient, KWPFrame, KWPFrameHandler } from '../types.js';
import { isKWPFrame } from '../guards.js';

export const DEFAULT_HTTP_PORT = 7341;

/**
 * HTTP fallback transport for Windows and serverless CI environments
 * where Unix domain sockets are unavailable.
 *
 * Protocol:
 *   POST /kwp         — send a KWP request frame, receive a response frame
 *   GET  /kwp/status  — returns { status: 'running' }
 *   GET  /kwp/events  — text/event-stream (server-sent events)
 *
 * All bodies are JSON-encoded KWPFrame objects.
 */

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function portString(port: number): string {
  return port.toString(10);
}

// ---------------------------------------------------------------------------
// Server-side transport
// ---------------------------------------------------------------------------

export class HttpTransport implements KernelTransport {
  readonly #port: number;
  #server: Server | null = null;
  readonly #sseClients = new Set<ServerResponse>();

  constructor(port = DEFAULT_HTTP_PORT) {
    this.#port = port;
  }

  get port(): number {
    return this.#port;
  }

  async start(handler: KWPFrameHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server = createServer((req, res) => {
        void this.#handleRequest(req, res, handler);
      });

      this.#server.on('error', reject);
      this.#server.listen(this.#port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  async #handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    handler: KWPFrameHandler,
  ): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/kwp/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'running' }));
      return;
    }

    if (req.url === '/kwp/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('retry: 3000\n\n');
      this.#sseClients.add(res);
      req.on('close', () => {
        this.#sseClients.delete(res);
      });
      return;
    }

    if (req.url === '/kwp' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const raw: unknown = JSON.parse(body);
        if (!isKWPFrame(raw)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid KWP frame' }));
          return;
        }

        const frame = raw;
        const reply = (responseFrame: KWPFrame): void => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseFrame));
        };

        await handler(frame, reply);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const errorFrame: KWPFrame = {
          type: 'error',
          id: 'unknown',
          error: { code: 'INTERNAL_ERROR', message },
        };
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(errorFrame));
      }
      return;
    }

    res.writeHead(404);
    res.end();
  }

  async stop(): Promise<void> {
    for (const client of this.#sseClients) {
      client.end();
    }
    this.#sseClients.clear();

    return new Promise((resolve, reject) => {
      if (!this.#server) {
        resolve();
        return;
      }
      this.#server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      this.#server = null;
    });
  }

  broadcast(frame: KWPFrame): void {
    const data = `data: ${JSON.stringify(frame)}\n\n`;
    for (const client of this.#sseClients) {
      client.write(data);
    }
  }
}

// ---------------------------------------------------------------------------
// Client-side transport
// ---------------------------------------------------------------------------

type EventHandler = (frame: KWPFrame) => void;

export class HttpClient implements TransportClient {
  readonly #baseUrl: string;
  readonly #eventHandlers = new Set<EventHandler>();
  #eventSource: EventSource | null = null;

  constructor(port = DEFAULT_HTTP_PORT) {
    this.#baseUrl = `http://127.0.0.1:${portString(port)}`;
  }

  async connect(): Promise<void> {
    const response = await fetch(`${this.#baseUrl}/kwp/status`);
    if (!response.ok) {
      throw new Error(`Kernel HTTP health check failed: ${response.status.toString(10)}`);
    }

    if (typeof EventSource !== 'undefined') {
      this.#eventSource = new EventSource(`${this.#baseUrl}/kwp/events`);
      this.#eventSource.onmessage = (e: MessageEvent<string>) => {
        const raw: unknown = JSON.parse(e.data);
        if (isKWPFrame(raw)) {
          for (const handler of this.#eventHandlers) handler(raw);
        }
      };
    }
  }

  disconnect(): Promise<void> {
    if (this.#eventSource) {
      this.#eventSource.close();
      this.#eventSource = null;
    }
    return Promise.resolve();
  }

  async request(frame: KWPFrame): Promise<KWPFrame> {
    const response = await fetch(`${this.#baseUrl}/kwp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(frame),
    });

    const raw: unknown = await response.json();

    if (!isKWPFrame(raw)) {
      throw new Error('Kernel returned a malformed KWP frame');
    }

    if (raw.type === 'error' && raw.error) {
      throw new Error(`[${raw.error.code}] ${raw.error.message}`);
    }

    return raw;
  }

  on(_event: 'event', handler: EventHandler): void {
    this.#eventHandlers.add(handler);
  }

  off(_event: 'event', handler: EventHandler): void {
    this.#eventHandlers.delete(handler);
  }
}
