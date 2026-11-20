import assert from 'node:assert/strict'
import test from 'node:test'
import { registerEventObservers, type EventContext } from '../src/host/events.ts'
import type { DecisionEngine } from '../src/host/decision.ts'
import type { NormalizedEvent } from '../src/host/types.ts'
import { quietLogger } from './helpers.ts'

type Listener = (...args: unknown[]) => unknown

function makeEventContext(options: { subagent?: boolean; title?: string } = {}) {
  const listeners = new Map<string, Listener>()
  const ctx = {
    on: (event: string, listener: Listener) => { listeners.set(event, listener) },
    sessions: {
      get: () => ({
        id: 'session-1',
        header: options.subagent === true ? { origin: 'subagent' as const } : {},
      }),
    },
    get: (name: string) => name === 'sessionTitle'
      ? { get: () => ({ title: options.title ?? 'Refactor database' }) }
      : undefined,
    logger: quietLogger,
  }
  return { ctx: ctx as unknown as EventContext, listeners }
}

function makeEngine(accept = true) {
  const began: NormalizedEvent[] = []
  const resolved: string[] = []
  const engine = {
    begin: (event: NormalizedEvent) => {
      began.push(event)
      return accept
    },
    resolve: (event: NormalizedEvent) => {
      resolved.push(event.eventId)
    },
  }
  return { engine: engine as unknown as DecisionEngine, began, resolved }
}

type Waterfall = (req: unknown, next: () => Promise<unknown>) => Promise<unknown>

test('approval observer calls next, begins once, and resolves after the waterfall', async () => {
  const { ctx, listeners } = makeEventContext()
  const { engine, began, resolved } = makeEngine()
  registerEventObservers(ctx, engine, { turnDone: false })
  const listener = listeners.get('approval/request') as unknown as Waterfall
  let nextCalls = 0
  const result = await listener({
    agent: { id: 'session-1' },
    toolName: 'bash',
    reason: 'delete temp files',
    callId: 'call-1',
  }, async () => {
    nextCalls += 1
    return 'allowed-once'
  })
  assert.equal(result, 'allowed-once')
  assert.equal(nextCalls, 1)
  assert.equal(began.length, 1)
  assert.equal(began[0]?.kind, 'approval')
  assert.equal(began[0]?.sessionTitle, 'Refactor database')
  assert.equal(resolved.length, 1)
})

test('a duplicate event does not resolve the existing record', async () => {
  const { ctx, listeners } = makeEventContext()
  const { engine, resolved } = makeEngine(false)
  registerEventObservers(ctx, engine, { turnDone: false })
  const listener = listeners.get('approval/request') as unknown as Waterfall
  const result = await listener({ agent: { id: 'session-1' } }, async () => 'allowed-once')
  assert.equal(result, 'allowed-once')
  assert.deepEqual(resolved, [])
})

test('question observer classifies plan-review and skips sessionless requests', async () => {
  const { ctx, listeners } = makeEventContext()
  const { engine, began } = makeEngine()
  registerEventObservers(ctx, engine, { turnDone: false })
  const listener = listeners.get('user-questions/request') as unknown as Waterfall

  await listener({
    agent: { id: 'session-1' },
    questions: [{ question: 'Approve this plan?', intent: { kind: 'plan-review' } }],
    wait: { callId: 'call-1' },
  }, async () => ({ answers: [] }))
  assert.equal(began[0]?.kind, 'plan-review')
  assert.equal(began[0]?.question, 'Approve this plan?')

  began.length = 0
  await listener({ questions: [{ question: 'Who are you?' }] }, async () => ({ answers: [] }))
  assert.deepEqual(began, [])
})

test('turnDone controls the turn observer and subagents are skipped', () => {
  const normal = makeEventContext()
  const disabled = makeEngine()
  registerEventObservers(normal.ctx, disabled.engine, { turnDone: false })
  const disabledListener = normal.listeners.get('session/event') as unknown as (session: unknown, event: unknown) => void
  disabledListener({ id: 'session-1', header: {} }, { type: 'turn/end', data: { turn: 1 } })
  assert.deepEqual(disabled.began, [])

  const enabled = makeEventContext()
  const turnEngine = makeEngine()
  registerEventObservers(enabled.ctx, turnEngine.engine, { turnDone: true })
  const enabledListener = enabled.listeners.get('session/event') as unknown as (session: unknown, event: unknown) => void
  enabledListener({ id: 'session-1', header: {} }, { type: 'turn/end', data: { turn: 2 } })
  assert.equal(turnEngine.began.length, 1)
  assert.equal(turnEngine.began[0]?.kind, 'turn')
  assert.equal(turnEngine.began[0]?.oneShot, true)

  const subagent = makeEventContext({ subagent: true })
  const subagentEngine = makeEngine()
  registerEventObservers(subagent.ctx, subagentEngine.engine, { turnDone: true })
  const subagentListener = subagent.listeners.get('session/event') as unknown as (session: unknown, event: unknown) => void
  subagentListener({ id: 'session-1', header: { origin: 'subagent' } }, { type: 'turn/end', data: { turn: 3 } })
  assert.deepEqual(subagentEngine.began, [])
})
