import assert from 'node:assert/strict'
import test from 'node:test'
import { PresenceStore, WEB_TTL_MS, SHELL_TTL_MS } from '../src/host/presence.ts'
import type { PresenceInput } from '../src/host/types.ts'
import { FakeClock } from './helpers.ts'

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

test('web presence expires at the web TTL and hides only after that', () => {
  const clock = new FakeClock()
  const store = new PresenceStore(clock)
  store.update(presence())
  assert.deepEqual(store.liveWebClientIds(), ['client-1'])
  clock.advance(WEB_TTL_MS)
  assert.deepEqual(store.liveWebClientIds(), ['client-1'])
  clock.advance(1)
  assert.deepEqual(store.liveWebClientIds(), [])
})

test('hidden web pages still count as live for ack waiting', () => {
  const clock = new FakeClock()
  const store = new PresenceStore(clock)
  store.update(presence({ visibility: 'hidden', focused: false }))
  assert.deepEqual(store.liveWebClientIds(), ['client-1'])
  assert.equal(store.phoneForeground(), false)
})

test('web visible ignores window focus but requires visible + the web TTL', () => {
  const clock = new FakeClock()
  const store = new PresenceStore(clock)
  store.update(presence())
  assert.equal(store.webVisible(), true)
  store.update(presence({ focused: false }))
  assert.equal(store.webVisible(), true)
  store.update(presence({ visibility: 'hidden' }))
  assert.equal(store.webVisible(), false)
  store.update(presence())
  clock.advance(WEB_TTL_MS + 1)
  assert.equal(store.webVisible(), false)
})

test('shell foreground requires visible + focused and the shorter TTL', () => {
  const clock = new FakeClock()
  const store = new PresenceStore(clock)
  store.update(presence({ platform: 'android-shell', clientId: 'phone' }))
  assert.equal(store.phoneForeground(), true)
  assert.deepEqual(store.liveWebClientIds(), [])
  clock.advance(SHELL_TTL_MS)
  assert.equal(store.phoneForeground(), true)
  clock.advance(1)
  assert.equal(store.phoneForeground(), false)
})

test('shell hidden or unfocused is not foreground', () => {
  const clock = new FakeClock()
  const store = new PresenceStore(clock)
  store.update(presence({ platform: 'android-shell', visibility: 'hidden' }))
  assert.equal(store.phoneForeground(), false)
  store.update(presence({ platform: 'android-shell', focused: false }))
  assert.equal(store.phoneForeground(), false)
})

test('counts and prune remove only expired records', () => {
  const clock = new FakeClock()
  const store = new PresenceStore(clock)
  store.update(presence({ clientId: 'web' }))
  store.update(presence({ platform: 'android-shell', clientId: 'phone' }))
  assert.deepEqual(store.counts(), { web: 1, androidShell: 1 })
  clock.advance(SHELL_TTL_MS + 1)
  assert.deepEqual(store.counts(), { web: 1, androidShell: 0 })
  clock.advance(WEB_TTL_MS)
  assert.deepEqual(store.counts(), { web: 0, androidShell: 0 })
})
