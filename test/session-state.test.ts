import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MOBILE_NOTIFY_PROJECTION,
  NOTICE_CLEAR_EVENT,
  NOTICE_EVENT,
  TURN_DONE_EVENT,
  createSessionState,
} from '../src/host/session-state.ts'
import { quietLogger } from './helpers.ts'

interface Definition {
  key: string
  stateSchema: { parse(value: unknown): unknown }
  init(): unknown
  apply(state: unknown, event: { type: string; data?: unknown }): unknown
  wire: { viewSchema: { parse(value: unknown): unknown }; view(state: unknown): unknown }
}

function harness() {
  let definition: Definition | undefined
  let state: unknown = { notice: null, turnDone: null }
  const appended: Array<{ type: string; data: unknown }> = []
  const registry = {
    register(value: Definition) {
      definition = value
      return Promise.resolve({ stateOf: () => state })
    },
  }
  const appendRecord = (_session: unknown, type: string, data: unknown) => {
    appended.push({ type, data })
    state = definition?.apply(state, { type, data })
  }
  const service = createSessionState(
    { get: name => name === 'sessionProjections' ? registry : undefined },
    quietLogger,
    appendRecord,
  )
  const session = { id: 'session-1' }
  return { service, session, appended, getDefinition: () => definition }
}

test('session state registers a client-visible projection key and defaults', async () => {
  const { getDefinition } = harness()
  await Promise.resolve()
  const definition = getDefinition()
  assert.ok(definition !== undefined)
  assert.equal(definition.key, MOBILE_NOTIFY_PROJECTION)
  assert.deepEqual(definition.init(), { notice: null, turnDone: null })
})

test('session state stores notices, clears only the matching key, and reads turn-done overrides', async () => {
  const { service, session, appended } = harness()
  await Promise.resolve()
  service.appendNotice(session, { key: 'n1', title: 'Build done', body: 'All tests pass.', createdAt: 1 })
  assert.equal(appended[0]?.type, NOTICE_EVENT)
  assert.equal(service.turnDoneFor({}), null)

  service.setTurnDone(session, true)
  assert.equal(appended[1]?.type, TURN_DONE_EVENT)
  assert.equal(service.turnDoneFor({}), true)

  service.clearNotice(session, 'other')
  assert.equal(service.turnDoneFor({}), true)
  service.clearNotice(session, 'n1')
  assert.equal(appended[2]?.type, NOTICE_CLEAR_EVENT)
  service.setTurnDone(session, null)
  assert.equal(service.turnDoneFor({}), null)
})

test('session state validates persisted values', async () => {
  const { getDefinition } = harness()
  await Promise.resolve()
  const definition = getDefinition()
  assert.ok(definition !== undefined)
  assert.throws(() => definition.stateSchema.parse({ notice: { key: '', title: 'x', createdAt: 1 }, turnDone: null }))
  assert.throws(() => definition.stateSchema.parse({ notice: null, turnDone: 'yes' }))
  assert.deepEqual(definition.wire.view(definition.init()), { notice: null, turnDone: null })
})
