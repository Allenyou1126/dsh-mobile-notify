import assert from 'node:assert/strict'
import test from 'node:test'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { resolveConfig } from '../src/config.ts'
import type { DecisionEngine } from '../src/host/decision.ts'
import { createNotifyToolDefinition, registerNotifyTool } from '../src/host/tool.ts'
import type { Logger, NormalizedEvent } from '../src/host/types.ts'
import { FakeClock, quietLogger } from './helpers.ts'

type Exec = Parameters<ToolDefinition['execute']>[1]

interface Appended {
  type: string
  data: unknown
}

function config(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    publicBase: 'https://dsh.example/',
    transport: 'dryRun',
    serverchan3: { fallbackUrl: 'https://dsh.example/' },
    ...overrides,
  })
}

function makeDefinition(options: { begin?: boolean; appendError?: Error } = {}) {
  const began: NormalizedEvent[] = []
  const resolved: NormalizedEvent[] = []
  const appended: Appended[] = []
  const engine = {
    begin(event: NormalizedEvent) {
      began.push(event)
      return options.begin !== false
    },
    resolve(event: NormalizedEvent) {
      resolved.push(event)
    },
  } as unknown as DecisionEngine
  const sessionState = {
    appendNotice: (_session: unknown, notice: unknown) => {
      if (options.appendError !== undefined) throw options.appendError
      appended.push({ type: 'notice', data: notice })
    },
    clearNotice: () => {},
    setTurnDone: () => {},
    turnDoneFor: () => null,
    status: () => 'ready' as const,
  }
  const definition = createNotifyToolDefinition({
    config: config(),
    engine,
    sessionState,
    logger: quietLogger,
    clock: new FakeClock(),
  })
  return { definition, began, resolved, appended }
}

function sessionAgent(): unknown {
  return {
    session: {
      id: 'session-1',
      append: () => {},
    },
  }
}

function exec(agent: unknown): Exec {
  return { agent, signal: new AbortController().signal } as unknown as Exec
}

test('mobile_notify queues a notice through the engine and session projection', async () => {
  const { definition, began, appended } = makeDefinition()
  assert.equal(definition.name, 'mobile_notify')
  assert.deepEqual(definition.parameters.required, ['title'])

  const result = await definition.execute({ title: 'Build done', body: 'All tests pass.' }, exec(sessionAgent()))
  assert.deepEqual(result, { ok: true, queued: true })
  assert.equal(began.length, 1)
  assert.equal(began[0]?.kind, 'notice')
  assert.equal(began[0]?.sessionId, 'session-1')
  assert.equal(began[0]?.oneShot, true)
  assert.equal(began[0]?.noticeTitle, 'Build done')
  assert.equal(began[0]?.noticeBody, 'All tests pass.')
  assert.equal(appended.length, 1)
})

test('mobile_notify without a body does not append an empty body', async () => {
  const { definition, began, appended } = makeDefinition()
  await definition.execute({ title: 'Build done' }, exec(sessionAgent()))
  assert.equal(began[0]?.noticeBody, undefined)
  assert.equal(appended[0]?.data !== undefined, true)
  const data = appended[0]?.data as { body?: string }
  assert.equal(data.body, undefined)
})

test('mobile_notify without an owning session still queues without a projection', async () => {
  const { definition, began, appended } = makeDefinition()
  await definition.execute({ title: 'Build done' }, exec(undefined))
  assert.equal(began[0]?.sessionId, '')
  assert.equal(appended.length, 0)
})

test('mobile_notify reports a disabled/duplicate queue as a tool error', async () => {
  const { definition } = makeDefinition({ begin: false })
  await assert.rejects(
    definition.execute({ title: 'Build done' }, exec(sessionAgent())),
    /notification tool is disabled or already pending/u,
  )
})

test('mobile_notify resolves the engine record when projection append fails', async () => {
  const { definition, resolved } = makeDefinition({ appendError: new Error('append failed') })
  await assert.rejects(definition.execute({ title: 'Build done' }, exec(sessionAgent())), /append failed/u)
  assert.equal(resolved.length, 1)
})

test('mobile_notify rejects empty, overlong, and non-string content', async () => {
  const { definition } = makeDefinition()
  await assert.rejects(definition.execute({ title: '   ' }, exec(sessionAgent())), /title must not be empty/u)
  await assert.rejects(definition.execute({ title: 'a'.repeat(61) }, exec(sessionAgent())), /title must be at most 60/u)
  await assert.rejects(definition.execute({ title: 'ok', body: 'a'.repeat(1001) }, exec(sessionAgent())), /body must be at most 1000/u)
  await assert.rejects(definition.execute({ title: 42 }, exec(sessionAgent())), /title/u)
})

test('mobile_notify is registered only when enabled and a tools service exists', () => {
  const definitions: ToolDefinition[] = []
  const tools = {
    register(definition: ToolDefinition) {
      definitions.push(definition)
      return () => { definitions.pop() }
    },
  }
  const ctx = { get: (name: string) => name === 'tools' ? tools : undefined }
  const deps = {
    config: config(),
    engine: { begin: () => true, resolve: () => {} } as unknown as DecisionEngine,
    sessionState: {
      appendNotice: () => {},
      clearNotice: () => {},
      setTurnDone: () => {},
      turnDoneFor: () => null,
      status: () => 'ready' as const,
    },
    logger: quietLogger,
    clock: new FakeClock(),
  }

  const registered = registerNotifyTool(ctx, deps)
  assert.equal(typeof registered, 'function')
  assert.equal(definitions[0]?.name, 'mobile_notify')

  const disabled = registerNotifyTool(ctx, { ...deps, config: config({ notify: { modelTool: false } }) })
  assert.equal(disabled, undefined)
  assert.equal(definitions.length, 1)

  const warnings: unknown[][] = []
  const logger: Logger = { ...quietLogger, warn: (...args: unknown[]) => { warnings.push(args) } }
  const missing = registerNotifyTool({ get: () => undefined }, { ...deps, logger })
  assert.equal(missing, undefined)
  assert.equal(warnings.length, 1)
})
