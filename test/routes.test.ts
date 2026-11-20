import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAck, parsePresence } from '../src/host/routes.ts'

const validPresence = {
  contract: 1,
  clientId: 'client-1',
  platform: 'web',
  visibility: 'visible',
  focused: true,
  notification: 'granted',
  at: new Date(0).toISOString(),
}

const validAck = {
  contract: 1,
  clientId: 'client-1',
  platform: 'web',
  sessionId: 'session-1',
  kind: 'approval',
  key: 'wait-1',
  delivered: true,
  via: 'in-page',
  reason: 'none',
  at: new Date(0).toISOString(),
}

test('parsePresence accepts a valid payload and optional activeSessionId', () => {
  const parsed = parsePresence(validPresence)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.clientId, 'client-1')
  assert.equal(parsed.value.activeSessionId, undefined)

  const withSession = parsePresence({ ...validPresence, activeSessionId: 'session-1' })
  assert.equal(withSession.ok, true)
  if (withSession.ok) assert.equal(withSession.value.activeSessionId, 'session-1')
})

test('parsePresence rejects bad contract, client id, enums, and timestamps', () => {
  assert.equal(parsePresence({ ...validPresence, contract: 0 }).ok, false)
  assert.equal(parsePresence({ ...validPresence, clientId: 'bad id' }).ok, false)
  assert.equal(parsePresence({ ...validPresence, platform: 'desktop' }).ok, false)
  assert.equal(parsePresence({ ...validPresence, visibility: 'away' }).ok, false)
  assert.equal(parsePresence({ ...validPresence, focused: 'yes' }).ok, false)
  assert.equal(parsePresence({ ...validPresence, notification: 'maybe' }).ok, false)
  assert.equal(parsePresence({ ...validPresence, at: 'not-a-date' }).ok, false)
  assert.equal(parsePresence({ ...validPresence, activeSessionId: 'bad id' }).ok, false)
  assert.equal(parsePresence(null).ok, false)
})

test('parseAck accepts delivered and failed acknowledgements', () => {
  const delivered = parseAck({ ...validAck, callId: 'call-1' })
  assert.equal(delivered.ok, true)
  if (delivered.ok) {
    assert.equal(delivered.value.delivered, true)
    assert.equal(delivered.value.via, 'in-page')
    assert.equal(delivered.value.callId, 'call-1')
  }
  const failed = parseAck({
    ...validAck,
    delivered: false,
    via: 'none',
    reason: 'permission-denied',
  })
  assert.equal(failed.ok, true)
})

test('parseAck rejects inconsistent delivery flags and invalid fields', () => {
  assert.equal(parseAck({ ...validAck, via: 'none' }).ok, false)
  assert.equal(parseAck({ ...validAck, reason: 'permission-denied' }).ok, false)
  assert.equal(parseAck({ ...validAck, delivered: false, via: 'in-page', reason: 'none' }).ok, false)
  assert.equal(parseAck({ ...validAck, delivered: false, via: 'none', reason: 'none' }).ok, false)
  assert.equal(parseAck({ ...validAck, kind: 'test' }).ok, false)
  assert.equal(parseAck({ ...validAck, key: '' }).ok, false)
  assert.equal(parseAck({ ...validAck, key: 'x'.repeat(257) }).ok, false)
  assert.equal(parseAck({ ...validAck, sessionId: 'bad id' }).ok, false)
  assert.equal(parseAck({ ...validAck, callId: '' }).ok, false)
})
