import assert from 'node:assert/strict'
import test from 'node:test'
import { DecisionEngine } from '../src/host/decision.ts'
import { PresenceStore } from '../src/host/presence.ts'
import type { PresenceInput } from '../src/host/types.ts'
import { FakeClock, RecordingTransport, makeAck, makeConfig, makeEvent, quietLogger } from './helpers.ts'

function presence(overrides: Partial<PresenceInput> = {}): PresenceInput {
  return {
    clientId: 'client-1',
    platform: 'web',
    visibility: 'visible',
    focused: true,
    notification: 'granted',
    at: new Date(0).toISOString(),
    ...overrides,
  }
}

function harness(overrides: Parameters<typeof makeConfig>[0] = {}) {
  const clock = new FakeClock()
  const config = makeConfig(overrides)
  const presenceStore = new PresenceStore(clock)
  const transport = new RecordingTransport()
  const engine = new DecisionEngine({
    config,
    clock,
    presence: presenceStore,
    transport,
    logger: quietLogger,
  })
  return { clock, config, presenceStore, transport, engine }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setImmediate(resolve))
}

test('resolved before debounce never pushes', async () => {
  const { clock, engine, transport } = harness()
  const event = makeEvent()
  engine.begin(event)
  clock.advance(1499)
  engine.resolve(event)
  clock.advance(1)
  await flush()
  assert.equal(transport.sent.length, 0)
  assert.equal(engine.pendingCount, 0)
  engine.dispose()
})

test('no web presence pushes after debounce', async () => {
  const { clock, engine, transport } = harness()
  engine.begin(makeEvent())
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 1)
  engine.dispose()
})

test('phone foreground suppresses when in-page is enabled', async () => {
  const { clock, presenceStore, engine, transport } = harness()
  presenceStore.update(presence({ platform: 'android-shell', clientId: 'phone' }))
  engine.begin(makeEvent())
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 0)
  assert.equal(engine.pendingCount, 1)
  engine.dispose()
})

test('phone foreground does not suppress when in-page is disabled', async () => {
  const { clock, presenceStore, engine, transport } = harness({ inPage: false })
  presenceStore.update(presence({ platform: 'android-shell', clientId: 'phone' }))
  engine.begin(makeEvent())
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 1)
  engine.dispose()
})

test('phone foreground does not suppress in strict in-page mode', async () => {
  const { clock, presenceStore, engine, transport } = harness({ inPageCountsAsDelivered: false })
  presenceStore.update(presence({ platform: 'android-shell', clientId: 'phone' }))
  engine.begin(makeEvent())
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 1)
  engine.dispose()
})

test('an early delivered ack suppresses the push', async () => {
  const { clock, presenceStore, engine, transport } = harness()
  presenceStore.update(presence())
  engine.begin(makeEvent())
  engine.onAck(makeAck())
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 0)
  engine.dispose()
})

test('all expected web clients acking false pushes immediately', async () => {
  const { clock, presenceStore, engine, transport } = harness()
  presenceStore.update(presence())
  engine.begin(makeEvent())
  engine.onAck(makeAck({ delivered: false, via: 'none', reason: 'unsupported' }))
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 1)
  engine.dispose()
})

test('an ack callId that the Host did not receive still matches the unique record', async () => {
  const { clock, presenceStore, engine, transport } = harness()
  presenceStore.update(presence())
  engine.begin(makeEvent())
  engine.onAck(makeAck({ callId: 'client-only-call' }))
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 0)
  engine.dispose()
})

test('a missing ack pushes only at the end of the grace window', async () => {
  const { clock, presenceStore, engine, transport } = harness()
  presenceStore.update(presence())
  engine.begin(makeEvent())
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 0)
  clock.advance(3999)
  await flush()
  assert.equal(transport.sent.length, 0)
  clock.advance(1)
  await flush()
  assert.equal(transport.sent.length, 1)
  engine.dispose()
})

test('phone returning to foreground during grace cancels the push', async () => {
  const { clock, presenceStore, engine, transport } = harness()
  presenceStore.update(presence())
  engine.begin(makeEvent())
  clock.advance(1500)
  await flush()
  presenceStore.update(presence({ platform: 'android-shell', clientId: 'phone' }))
  clock.advance(4000)
  await flush()
  assert.equal(transport.sent.length, 0)
  engine.dispose()
})

test('any web client delivering suppresses a multi-client push', async () => {
  const { clock, presenceStore, engine, transport } = harness()
  presenceStore.update(presence({ clientId: 'web-a' }))
  presenceStore.update(presence({ clientId: 'web-b' }))
  engine.begin(makeEvent())
  clock.advance(1500)
  engine.onAck(makeAck({ clientId: 'web-a', delivered: false, via: 'none', reason: 'unsupported' }))
  engine.onAck(makeAck({ clientId: 'web-b', delivered: true }))
  clock.advance(4000)
  await flush()
  assert.equal(transport.sent.length, 0)
  engine.dispose()
})

test('duplicate events do not create a second push', async () => {
  const { clock, engine, transport } = harness()
  const event = makeEvent()
  engine.begin(event)
  engine.begin(event)
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 1)
  engine.dispose()
})

test('turn events wait for a delivered ack and fall back without one', async () => {
  const { clock, presenceStore, engine, transport } = harness({ turnDone: true })
  presenceStore.update(presence({ focused: false }))
  engine.begin(makeEvent({ kind: 'turn', oneShot: true }))
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 0)
  clock.advance(4000)
  await flush()
  assert.equal(transport.sent.length, 1)
  assert.equal(engine.pendingCount, 0)
  engine.dispose()
})

test('a delivered turn ack suppresses the Server酱 fallback', async () => {
  const { clock, presenceStore, engine, transport } = harness({ turnDone: true })
  presenceStore.update(presence({ focused: false }))
  engine.begin(makeEvent({ kind: 'turn', oneShot: true }))
  clock.advance(1500)
  await flush()
  engine.onAck(makeAck({ kind: 'turn', key: 'turn', via: 'web-notification' }))
  clock.advance(4000)
  await flush()
  assert.equal(transport.sent.length, 0)
  assert.equal(engine.pendingCount, 0)
  engine.dispose()
})

test('one-shot turn events are removed after delivery', async () => {
  const { clock, engine, transport } = harness({ turnDone: true })
  engine.begin(makeEvent({ kind: 'turn', oneShot: true }))
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 1)
  assert.equal(engine.pendingCount, 0)
  engine.dispose()
})

test('dispose cancels pending timers and future pushes', async () => {
  const { clock, engine, transport } = harness()
  engine.begin(makeEvent())
  engine.dispose()
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 0)
})

test('disabled event kinds are ignored', async () => {
  const { clock, engine, transport } = harness({ approval: false })
  engine.begin(makeEvent())
  clock.advance(1500)
  await flush()
  assert.equal(transport.sent.length, 0)
  engine.dispose()
})
