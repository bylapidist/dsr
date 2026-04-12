import { EventEmitter } from 'node:events';
import type { KernelEvent, KWPFrame } from '../types.js';

type KernelEventHandler = (event: KernelEvent) => void;

/**
 * Typed event bus for kernel events.
 *
 * The bus decouples kernel state mutations from transport-level broadcast.
 * Each transport registers a listener and serialises events into KWP event
 * frames for connected clients.
 */
export class KernelEventBus {
  readonly #emitter = new EventEmitter();

  emit(event: KernelEvent): void {
    this.#emitter.emit('kernel-event', event);
  }

  on(handler: KernelEventHandler): void {
    this.#emitter.on('kernel-event', handler);
  }

  off(handler: KernelEventHandler): void {
    this.#emitter.off('kernel-event', handler);
  }

  once(handler: KernelEventHandler): void {
    this.#emitter.once('kernel-event', handler);
  }

  /**
   * Converts a KernelEvent into a KWP event frame for wire transmission.
   */
  static toKWPFrame(event: KernelEvent): KWPFrame {
    return {
      type: 'event',
      id: crypto.randomUUID(),
      method: event.type,
      payload: event,
    };
  }

  removeAllListeners(): void {
    this.#emitter.removeAllListeners();
  }
}
