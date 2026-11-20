import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAckPayload } from '../src/client/ack.ts'
import { parseClientConfig } from '../src/client/config.ts'
import { decideDelivery, kindTitle, notificationTitle, summarizePending } from '../src/client/delivery.ts'
import { buildPresencePayload, environmentWithShell } from '../src/client/presence.ts'
import { DEFAULT_CLIENT_CONFIG, type ClientConfig, type PendingItem } from '../src/client/types.ts'
import type { Translate } from '../src/client/locale.ts'

const t: Translate = key => key

function item(overrides: Partial<PendingItem> = {}): PendingItem {
  return {
    key: 'session-1:wait-1',
    sessionId: 'session-1',
    kind: 'approval',
    rawKind: 'approval',
    waitKey: 'wait-1',
    label: 'Refactor database',
    toolName: 'bash',
    reason: 'delete temp files',
    ...overrides,
  }
}

function config(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return { ...DEFAULT_CLIENT_CONFIG, ...overrides }
}

test('decideDelivery prefers a mounted in-page banner when visible and focused', () => {
  const decision = decideDelivery({
    visible: true,
    focused: true,
    bannerAvailable: true,
    notification: 'granted',
  }, config())
  assert.deepEqual(decision, {
    mode: 'in-page',
    via: 'in-page',
    reason: 'none',
    needsInPageAck: true,
  })
})

test('decideDelivery suppresses the card for the Session already open in the main view', () => {
  const decision = decideDelivery({
    visible: true,
    focused: true,
    bannerAvailable: true,
    notification: 'granted',
    viewingSession: true,
  }, config())
  assert.deepEqual(decision, {
    mode: 'in-page',
    via: 'in-page',
    reason: 'none',
    needsInPageAck: false,
    suppressCard: true,
  })
})

test('open Session suppression requires the normal in-page delivery conditions', () => {
  assert.equal(
    decideDelivery({
      visible: false,
      focused: false,
      bannerAvailable: true,
      notification: 'granted',
      viewingSession: true,
    }, config()).mode,
    'web-notification',
  )
  assert.equal(
    decideDelivery({
      visible: true,
      focused: true,
      bannerAvailable: true,
      notification: 'granted',
      viewingSession: true,
    }, config({ inPageCountsAsDelivered: false })).mode,
    'web-notification',
  )
})

test('decideDelivery falls back to a system notification when hidden', () => {
  const decision = decideDelivery({
    visible: false,
    focused: false,
    bannerAvailable: true,
    notification: 'granted',
  }, config())
  assert.deepEqual(decision, {
    mode: 'web-notification',
    via: 'web-notification',
    reason: 'none',
    needsInPageAck: false,
  })
})

test('decideDelivery reports permission and capability failures', () => {
  assert.equal(
    decideDelivery({ visible: false, focused: false, bannerAvailable: true, notification: 'denied' }, config()).reason,
    'permission-denied',
  )
  assert.equal(
    decideDelivery({ visible: false, focused: false, bannerAvailable: true, notification: 'unsupported' }, config()).reason,
    'unsupported',
  )
  assert.equal(
    decideDelivery(
      { visible: false, focused: false, bannerAvailable: true, notification: 'granted' },
      config({ webNotification: false }),
    ).reason,
    'hidden-no-notification',
  )
})

test('decideDelivery uses a notification when in-page is disabled or not a delivery signal', () => {
  assert.equal(
    decideDelivery({ visible: true, focused: true, bannerAvailable: true, notification: 'granted' }, config({ inPage: false })).mode,
    'web-notification',
  )
  assert.equal(
    decideDelivery(
      { visible: true, focused: true, bannerAvailable: true, notification: 'granted' },
      config({ inPageCountsAsDelivered: false }),
    ).mode,
    'web-notification',
  )
  assert.equal(
    decideDelivery({ visible: true, focused: true, bannerAvailable: false, notification: 'granted' }, config()).mode,
    'web-notification',
  )
})

test('summary and notification title respect detail and privacy', () => {
  assert.equal(kindTitle('approval', t), 'banner.approval')
  assert.equal(notificationTitle(item(), t), 'Refactor database · banner.approval')
  assert.match(summarizePending(item(), config(), t), /Refactor database · bash · delete temp files/u)

  const generic = summarizePending(item(), config({ detail: 'generic' }), t)
  assert.equal(generic, 'banner.generic')

  const noReason = summarizePending(
    item(),
    config({ includeReason: false, includeToolName: false }),
    t,
  )
  assert.equal(noReason, 'Refactor database')

  const question = summarizePending(item({ kind: 'question', question: 'Which database?', toolName: undefined }), config(), t)
  assert.match(question, /Which database\?/u)

  assert.equal(notificationTitle(item(), t, config({ detail: 'generic' })), 'banner.generic')
  assert.equal(notificationTitle(item(), t, config({ includeSessionTitle: false })), 'banner.approval')
})

test('parseClientConfig validates fields and falls back safely', () => {
  const parsed = parseClientConfig({
    client: {
      inPage: false,
      webNotification: true,
      inPageCountsAsDelivered: false,
      turnDone: true,
      settleMs: 300,
      detail: 'title',
      includeSessionTitle: false,
      includeReason: false,
      includeToolName: true,
    },
  })
  assert.deepEqual(parsed, {
    inPage: false,
    webNotification: true,
    inPageCountsAsDelivered: false,
    turnDone: true,
    settleMs: 300,
    detail: 'title',
    includeSessionTitle: false,
    includeReason: false,
    includeToolName: true,
  })
  assert.equal(parseClientConfig(null), undefined)
  assert.equal(parseClientConfig({ client: {} })?.settleMs, DEFAULT_CLIENT_CONFIG.settleMs)
  assert.equal(parseClientConfig({ client: { settleMs: 99999 } })?.settleMs, DEFAULT_CLIENT_CONFIG.settleMs)
  assert.equal(parseClientConfig({ client: { detail: 'nope' } })?.detail, DEFAULT_CLIENT_CONFIG.detail)
})

test('presence payload includes the shell override and required contract fields', () => {
  const web = { visibility: 'visible' as const, focused: true, notification: 'granted' as const }
  const hidden = environmentWithShell(web, false)
  assert.equal(hidden.visibility, 'hidden')
  assert.equal(hidden.focused, false)
  const payload = buildPresencePayload('client-1', 'android-shell', hidden, new Date(0))
  assert.deepEqual(payload, {
    contract: 1,
    clientId: 'client-1',
    platform: 'android-shell',
    visibility: 'hidden',
    focused: false,
    notification: 'granted',
    at: new Date(0).toISOString(),
  })
})

test('ack payload carries the optional callId and failure reason', () => {
  const delivered = buildAckPayload(item({ callId: 'call-1' }), 'client-1', 'web', true, 'in-page', 'none', new Date(0))
  assert.equal(delivered.callId, 'call-1')
  assert.equal(delivered.delivered, true)
  const failed = buildAckPayload(item(), 'client-1', 'web', false, 'none', 'unsupported', new Date(0))
  assert.equal(failed.delivered, false)
  assert.equal(failed.reason, 'unsupported')
})
