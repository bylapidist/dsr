import { createServer, createConnection } from 'node:net';
import type { Server, Socket } from 'node:net';
import { pack, unpack } from 'msgpackr';
import type { KernelTransport, TransportClient, KWPFrame, KWPFrameHandler } from '../types.js';
import { isKWPFrame } from '../guards.js';

export const DEFAULT_SOCKET_PATH = '/tmp/designlint-kernel.sock';

/**
 * Length-prefixed framing over a Unix domain socket.
 *
 * Wire format per message:
 *   [0..3]  uint32 BE — payload byte length
 *   [4..N]  MessagePack-encoded KWPFrame
 */

function encodeFrame(frame: KWPFrame): Buffer {
  const payload = pack(frame);
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function createFrameParser(onFrame: (frame: KWPFrame) => void) {
  let buf = Buffer.alloc(0);

  return function push(chunk: Buffer): void {
    buf = Buffer.concat([buf, chunk]);

    while (buf.length >= 4) {
      const payloadLength = buf.readUInt32BE(0);
      if (buf.length < 4 + payloadLength) break;

      const payload = buf.subarray(4, 4 + payloadLength);
      buf = buf.subarray(4 + payloadLength);

      const raw: unknown = unpack(payload);
      if (isKWPFrame(raw)) onFrame(raw);
    }
  };
}

// ---------------------------------------------------------------------------
// Server-side transport
// ---------------------------------------------------------------------------

export class UnixSocketTransport implements KernelTransport {
  readonly #socketPath: string;
  #server: Server | null = null;
  readonly #clients = new Set<Socket>();

  constructor(socketPath = DEFAULT_SOCKET_PATH) {
    this.#socketPath = socketPath;
  }

  get socketPath(): string {
    return this.#socketPath;
  }

  async start(handler: KWPFrameHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server = createServer((socket) => {
        this.#clients.add(socket);

        const push = createFrameParser((frame) => {
          const reply = (responseFrame: KWPFrame): void => {
            socket.write(encodeFrame(responseFrame));
          };
          handler(frame, reply).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            reply({
              type: 'error',
              id: frame.id,
              error: { code: 'INTERNAL_ERROR', message },
            });
          });
        });

        socket.on('data', push);
        socket.on('close', () => {
          this.#clients.delete(socket);
        });
        socket.on('error', () => {
          this.#clients.delete(socket);
        });
      });

      this.#server.on('error', reject);
      this.#server.listen(this.#socketPath, () => {
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.#clients) {
      client.destroy();
    }
    this.#clients.clear();

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
    const encoded = encodeFrame(frame);
    for (const client of this.#clients) {
      client.write(encoded);
    }
  }
}

// ---------------------------------------------------------------------------
// Client-side transport
// ---------------------------------------------------------------------------

type EventHandler = (frame: KWPFrame) => void;

export class UnixSocketClient implements TransportClient {
  readonly #socketPath: string;
  #socket: ReturnType<typeof createConnection> | null = null;
  readonly #pending = new Map<string, (frame: KWPFrame) => void>();
  readonly #eventHandlers = new Set<EventHandler>();

  constructor(socketPath = DEFAULT_SOCKET_PATH) {
    this.#socketPath = socketPath;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = createConnection(this.#socketPath);

      const push = createFrameParser((frame) => {
        if (frame.type === 'event') {
          for (const handler of this.#eventHandlers) handler(frame);
          return;
        }

        const resolver = this.#pending.get(frame.id);
        if (resolver) {
          this.#pending.delete(frame.id);
          resolver(frame);
        }
      });

      socket.on('data', push);
      socket.on('error', reject);
      socket.once('connect', () => {
        socket.off('error', reject);
        socket.on('error', () => {
          /* connection-level errors handled per-request via pending map */
        });
        this.#socket = socket;
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.#socket) {
        resolve();
        return;
      }
      this.#socket.once('close', resolve);
      this.#socket.destroy();
      this.#socket = null;
    });
  }

  async request(frame: KWPFrame): Promise<KWPFrame> {
    const socket = this.#socket;
    if (!socket) throw new Error('Not connected to kernel');

    return new Promise((resolve, reject) => {
      this.#pending.set(frame.id, (response) => {
        if (response.type === 'error' && response.error) {
          reject(new Error(`[${response.error.code}] ${response.error.message}`));
        } else {
          resolve(response);
        }
      });
      socket.write(encodeFrame(frame));
    });
  }

  on(_event: 'event', handler: EventHandler): void {
    this.#eventHandlers.add(handler);
  }

  off(_event: 'event', handler: EventHandler): void {
    this.#eventHandlers.delete(handler);
  }
}
