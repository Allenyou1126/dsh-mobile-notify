import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveConfig } from '../src/config.ts'
import {
  ServerChanTransport,
  buildPayload,
  buildScopenUrl,
} from '../src/host/serverchan3.ts'
import type { Logger } from '../src/host/types.ts'
import { FakeClock, makeEvent, quietLogger } from './helpers.ts'

function config(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    publicBase: 'https://dsh.example/',
    transport: 'dryRun',
    serverchan3: { fallbackUrl: 'https://dsh.example/' },
    ...overrides,
  })
}

test('approval payload contains the summary, one-line scopen link, and default tags', () => {
  const built = buildPayload(makeEvent({ callId: 'call-1' }), config())
  assert.equal(built.payload.title, 'DSH · 需要审批')
  assert.equal(built.payload.short, 'Refactor database · bash · delete temp files')
  assert.equal(built.payload.tags, 'dsh|dsh-approval')
  assert.match(built.payload.desp, /\*\*会话\*\*：Refactor database/u)
  assert.match(built.payload.desp, /\*\*工具\*\*：bash/u)
  assert.match(built.payload.desp, /\*\*原因\*\*：delete temp files/u)
  const link = buildScopenUrl(makeEvent({ callId: 'call-1' }), config())
  assert.ok(link !== undefined)
  assert.match(link, /^scopen:\/\/top\.allenyou\.dsh\?/u)
  assert.match(link, /sessionId=session-1/u)
  assert.match(link, /kind=approval/u)
  assert.match(link, /requestId=call-1/u)
  assert.match(link, /sc\.market=0/u)
  assert.match(link, /sc\.fallback=https%3A%2F%2Fdsh\.example%2F/u)
  assert.doesNotMatch(link, /\s/u)
  assert.match(built.payload.desp, /\n\[打开 DSH\]\(scopen:\/\/top\.allenyou\.dsh\?/u)
})

test('generic detail removes session, tool, and reason but keeps tags', () => {
  const generic = config({ notify: { detail: 'generic' } })
  const built = buildPayload(makeEvent(), generic)
  assert.equal(built.payload.title, 'DSH · 有待处理提醒')
  assert.equal(built.payload.short, 'DSH 有待处理提醒')
  assert.doesNotMatch(built.payload.desp, /Refactor database|bash|delete temp files/u)
  assert.equal(built.payload.tags, 'dsh|dsh-approval')
})

test('title detail keeps the session but omits reason and tool', () => {
  const titled = config({ notify: { detail: 'title' } })
  const built = buildPayload(makeEvent(), titled)
  assert.match(built.payload.short, /Refactor database/u)
  assert.doesNotMatch(built.payload.short, /bash|delete temp files/u)
  assert.doesNotMatch(built.payload.desp, /delete temp files/u)
})

test('invalid session ids fall back to the public URL instead of scopen', () => {
  const event = makeEvent({ sessionId: 'bad session id' })
  const built = buildPayload(event, config())
  assert.equal(buildScopenUrl(event, config()), undefined)
  assert.match(built.payload.desp, /\n\[打开 DSH\]\(https:\/\/dsh\.example\/\)/u)
})

test('test pushes use the test tag and never create a scopen link', () => {
  const event = makeEvent({ kind: 'test', sessionId: 'test', sessionTitle: '' })
  const built = buildPayload(event, config())
  assert.equal(built.payload.title, 'DSH · 测试通知')
  assert.equal(built.payload.tags, 'dsh|dsh-test')
  assert.doesNotMatch(built.payload.desp, /scopen:/u)
})

test('model notices use the explicit title/body and the notice tag', () => {
  const event = makeEvent({
    kind: 'notice',
    sessionTitle: '',
    noticeTitle: 'Build finished',
    noticeBody: 'All tests pass.\nReady to deploy.',
  })
  const built = buildPayload(event, config())
  assert.equal(built.payload.title, 'DSH · Build finished')
  assert.equal(built.payload.short, 'All tests pass. Ready to deploy.')
  assert.equal(built.payload.tags, 'dsh|dsh-notice')
  assert.match(built.payload.desp, /All tests pass\.\nReady to deploy\./u)
  assert.match(built.payload.desp, /scopen:\/\/top\.allenyou\.dsh\?/u)
  assert.match(built.payload.desp, /kind=notice/u)
  const link = buildScopenUrl(event, config())
  assert.ok(link !== undefined)
  assert.match(link, /sessionId=session-1/u)
  assert.doesNotMatch(link, /requestId=/u)
})

test('model notices follow the generic detail privacy level', () => {
  const event = makeEvent({
    kind: 'notice',
    sessionTitle: '',
    noticeTitle: 'Build finished',
    noticeBody: 'All tests pass.',
  })
  const built = buildPayload(event, config({ notify: { detail: 'generic' } }))
  assert.equal(built.payload.title, 'DSH · 通知')
  assert.equal(built.payload.short, 'DSH 通知')
  assert.doesNotMatch(built.payload.desp, /Build finished|All tests pass/u)
  assert.match(built.payload.desp, /scopen:\/\/top\.allenyou\.dsh\?/u)
})

test('model notices in title detail keep the session but omit the body', () => {
  const event = makeEvent({
    kind: 'notice',
    sessionTitle: 'Refactor database',
    noticeTitle: 'Build finished',
    noticeBody: 'All tests pass.',
  })
  const built = buildPayload(event, config({ notify: { detail: 'title' } }))
  assert.equal(built.payload.title, 'DSH · 通知')
  assert.match(built.payload.short, /Refactor database/u)
  assert.doesNotMatch(built.payload.short, /Build finished|All tests pass/u)
  assert.doesNotMatch(built.payload.desp, /Build finished|All tests pass/u)
})

test('model notices without a session use the fallback URL', () => {
  const event = makeEvent({
    kind: 'notice',
    sessionId: '',
    sessionTitle: '',
    noticeTitle: 'Build finished',
    noticeBody: 'All tests pass.',
  })
  assert.equal(buildScopenUrl(event, config()), undefined)
  const built = buildPayload(event, config())
  assert.match(built.payload.desp, /\n\[打开 DSH\]\(https:\/\/dsh\.example\/\)/u)
})

test('a notice title that already starts with DSH is not prefixed twice', () => {
  const built = buildPayload(makeEvent({
    kind: 'notice',
    sessionTitle: '',
    noticeTitle: 'DSH 构建完成',
  }), config())
  assert.equal(built.payload.title, 'DSH 构建完成')
})

test('dryRun does not call fetch and returns a dry-run result', async () => {
  const calls: string[] = []
  const transport = new ServerChanTransport({
    config: config(),
    logger: quietLogger,
    clock: new FakeClock(),
    sendkey: async () => undefined,
    fetchImpl: async url => {
      calls.push(url)
      return new Response('{}', { status: 200 })
    },
  })
  const result = await transport.send(makeEvent(), new AbortController().signal)
  assert.deepEqual(result, { ok: true, dryRun: true })
  assert.deepEqual(calls, [])
})

test('serverchan3 sends JSON with tags and never includes the SendKey in the body', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const transport = new ServerChanTransport({
    config: config({
      transport: 'serverchan3',
      serverchan3: { appPackage: 'top.allenyou.dsh' },
    }),
    logger: quietLogger,
    clock: new FakeClock(),
    sendkey: async () => 'sctp42tTOKEN',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ code: 0 }), { status: 200 })
    },
  })
  const result = await transport.send(makeEvent(), new AbortController().signal)
  assert.deepEqual(result, { ok: true, dryRun: false, status: 200 })
  assert.equal(calls.length, 1)
  const call = calls[0]
  assert.ok(call !== undefined)
  assert.equal(call.url, 'https://42.push.ft07.com/send/sctp42tTOKEN.send')
  const body = JSON.parse(String(call.init.body)) as Record<string, unknown>
  assert.equal(body.tags, 'dsh|dsh-approval')
  assert.equal(typeof body.title, 'string')
  assert.doesNotMatch(String(call.init.body), /sctp42tTOKEN|SendKey/u)
})

test('upstream failures are reported, not thrown', async () => {
  const warnings: unknown[][] = []
  const logger: Logger = {
    ...quietLogger,
    warn: (...args: unknown[]) => { warnings.push(args) },
  }
  const transport = new ServerChanTransport({
    config: config({
      transport: 'serverchan3',
      serverchan3: { appPackage: 'top.allenyou.dsh' },
      limits: { pushRetries: 0 },
    }),
    logger,
    clock: new FakeClock(),
    sendkey: async () => 'sctp42tTOKEN',
    fetchImpl: async () => new Response('{}', { status: 500 }),
  })
  const result = await transport.send(makeEvent(), new AbortController().signal)
  assert.equal(result.ok, false)
  assert.equal(result.status, 500)
  assert.ok(warnings.length > 0)
})

test('network error text is redacted before it reaches the result', async () => {
  const warnings: unknown[][] = []
  const transport = new ServerChanTransport({
    config: config({
      transport: 'serverchan3',
      serverchan3: { appPackage: 'top.allenyou.dsh' },
      limits: { pushRetries: 0 },
    }),
    logger: { ...quietLogger, warn: (...args: unknown[]) => { warnings.push(args) } },
    clock: new FakeClock(),
    sendkey: async () => 'sctp42tTOKEN',
    fetchImpl: async () => {
      throw new Error('request failed for sctp42tTOKEN')
    },
  })
  const result = await transport.send(makeEvent(), new AbortController().signal)
  assert.equal(result.ok, false)
  assert.doesNotMatch(String(result.error), /sctp42tTOKEN/u)
  assert.equal(warnings.length, 1)
  assert.doesNotMatch(JSON.stringify(warnings), /sctp42tTOKEN/u)
})

test('outbound rate limit blocks a second push in the same minute', async () => {
  let calls = 0
  const transport = new ServerChanTransport({
    config: config({
      transport: 'serverchan3',
      serverchan3: { appPackage: 'top.allenyou.dsh' },
      limits: { pushPerMinute: 1 },
    }),
    logger: quietLogger,
    clock: new FakeClock(),
    sendkey: async () => 'sctp42tTOKEN',
    fetchImpl: async () => {
      calls += 1
      return new Response(JSON.stringify({ code: 0 }), { status: 200 })
    },
  })
  const first = await transport.send(makeEvent(), new AbortController().signal)
  const second = await transport.send(makeEvent({ eventId: 'event-2' }), new AbortController().signal)
  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
  assert.equal(second.error, 'rate_limited')
  assert.equal(calls, 1)
})
