import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KernelEventBus } from '../../src/kernel/event-bus.js';
import type { KernelEvent } from '../../src/types.js';

describe('KernelEventBus', () => {
  it('delivers emitted events to registered handlers', () => {
    const bus = new KernelEventBus();
    const received: KernelEvent[] = [];

    bus.on((event) => received.push(event));

    const event: KernelEvent = { type: 'token.removed', pointer: '#/color/old' };
    bus.emit(event);

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], event);
  });

  it('stops delivering after off() is called', () => {
    const bus = new KernelEventBus();
    const received: KernelEvent[] = [];
    const handler = (event: KernelEvent): void => {
      received.push(event);
    };

    bus.on(handler);
    bus.emit({ type: 'token.removed', pointer: '#/color/a' });
    bus.off(handler);
    bus.emit({ type: 'token.removed', pointer: '#/color/b' });

    assert.equal(received.length, 1);
  });

  it('delivers once() handler exactly one time', () => {
    const bus = new KernelEventBus();
    const received: KernelEvent[] = [];

    bus.once((event) => received.push(event));
    bus.emit({ type: 'token.removed', pointer: '#/color/a' });
    bus.emit({ type: 'token.removed', pointer: '#/color/b' });

    assert.equal(received.length, 1);
  });

  it('toKWPFrame produces a valid event frame', () => {
    const event: KernelEvent = {
      type: 'entropy.updated',
      score: {
        overall: 80,
        byCategory: {},
        components: {
          tokenCoverageRatio: 0.9,
          violationRecurrenceRate: 0.05,
          agentAttributionRatio: 0.1,
          rateOfChange: 0.02,
          violationConcentration: 0.1,
        },
        measuredAt: new Date().toISOString(),
      },
    };

    const frame = KernelEventBus.toKWPFrame(event);

    assert.equal(frame.type, 'event');
    assert.equal(typeof frame.id, 'string');
    assert.equal(frame.method, 'entropy.updated');
    assert.deepEqual(frame.payload, event);
  });

  it('removeAllListeners silences all handlers', () => {
    const bus = new KernelEventBus();
    const received: KernelEvent[] = [];

    bus.on((event) => received.push(event));
    bus.removeAllListeners();
    bus.emit({ type: 'token.removed', pointer: '#/color/x' });

    assert.equal(received.length, 0);
  });
});
