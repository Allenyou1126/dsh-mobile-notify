import assert from 'node:assert/strict'
import test from 'node:test'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { resolveConfig } from '../src/config.ts'
import { createNotifyToolDefinition, registerNotifyTool } from '../src/host/tool.ts'
import type { Logger, NormalizedEvent, PushResult, Transport } from '../src/host/types.ts'
import { FakeClock, quietLogger } from './helpers.ts'

type Exec = Parameters<ToolDefinition['execute']>[1]

function config(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    publicBase: 'https://dsh.example/',
    transport: 'dryRun',
    serverchan3: { fallbackUrl: 'https://dsh.example/' },
    ...overrides,
  })
}

function makeDefinition(result: PushResult) {
  const sent: NormalizedEvent[] = []
  const reported: PushResult[] = []
  const transport: Transport = {
    async send(event) {
      sent.push(event)
      return result
    },
  }
  const definition = createNotifyToolDefinition({
    config: config(),
    transport,
    logger: quietLogger,
    clock: new FakeClock(),
    onPushResult: value => { reported.push(value) },
  })
  return { definition, sent, reported }
}

function exec(agent: unknown = { session: { id: 'session-1' } }): Exec {
  return { agent, signal: new AbortController().signal } as unknown as Exec
}

function execWith(agent: unknown): Exec {
  return { agent, signal: new AbortController().signal } as unknown as Exec
}

test('mobile_notify sends a notice with its title/body and the calling session', async () => {
  const { definition, sent, reported } = makeDefinition({ ok: true, dryRun: false, status: 200 })
  assert.equal(definition.name, 'mobile_notify')
  assert.deepEqual(definition.parameters.required, ['title'])

  const result = await definition.execute({ title: 'Build done', body: 'All tests pass.' }, exec())
  assert.deepEqual(result, { ok: true, dryRun: false })
  assert.equal(sent.length, 1)
  assert.equal(sent[0]?.kind, 'notice')
  assert.equal(sent[0]?.sessionId, 'session-1')
  assert.equal(sent[0]?.noticeTitle, 'Build done')
  assert.equal(sent[0]?.noticeBody, 'All tests pass.')
  assert.deepEqual(reported, [{ ok: true, dryRun: false, status: 200 }])
})

test('mobile_notify without a body defaults to the title', async () => {
  const { definition, sent } = makeDefinition({ ok: true, dryRun: true })
  const result = await definition.execute({ title: 'Build done' }, exec())
  assert.deepEqual(result, { ok: true, dryRun: true })
  assert.equal(sent[0]?.noticeBody, undefined)
})

test('mobile_notify without an owning session omits the deep link session', async () => {
  const { definition, sent } = makeDefinition({ ok: true, dryRun: true })
  await definition.execute({ title: 'Build done' }, execWith(undefined))
  assert.equal(sent[0]?.sessionId, '')
})

test('mobile_notify reports upstream failure as a tool error', async () => {
  const { definition, reported } = makeDefinition({ ok: false, dryRun: false, error: 'rate_limited' })
  await assert.rejects(
    definition.execute({ title: 'Build done', body: 'All tests pass.' }, exec()),
    /mobile_notify failed: rate_limited/u,
  )
  assert.equal(reported[0]?.ok, false)
})

test('mobile_notify rejects empty, overlong, and non-string content', async () => {
  const { definition } = makeDefinition({ ok: true, dryRun: true })
  await assert.rejects(definition.execute({ title: '   ' }, exec()), /title must not be empty/u)
  await assert.rejects(definition.execute({ title: 'a'.repeat(61) }, exec()), /title must be at most 60/u)
  await assert.rejects(definition.execute({ title: 'ok', body: 'a'.repeat(1001) }, exec()), /body must be at most 1000/u)
  await assert.rejects(definition.execute({ title: 42 }, exec()), /title/u)
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

  const registered = registerNotifyTool(ctx, {
    config: config(),
    transport: { send: async () => ({ ok: true, dryRun: true }) },
    logger: quietLogger,
    clock: new FakeClock(),
  })
  assert.equal(typeof registered, 'function')
  assert.equal(definitions[0]?.name, 'mobile_notify')

  const disabled = registerNotifyTool(ctx, {
    config: config({ notify: { modelTool: false } }),
    transport: { send: async () => ({ ok: true, dryRun: true }) },
    logger: quietLogger,
    clock: new FakeClock(),
  })
  assert.equal(disabled, undefined)
  assert.equal(definitions.length, 1)

  const warnings: unknown[][] = []
  const logger: Logger = { ...quietLogger, warn: (...args: unknown[]) => { warnings.push(args) } }
  const missing = registerNotifyTool({ get: () => undefined }, {
    config: config(),
    transport: { send: async () => ({ ok: true, dryRun: true }) },
    logger,
    clock: new FakeClock(),
  })
  assert.equal(missing, undefined)
  assert.equal(warnings.length, 1)
})
