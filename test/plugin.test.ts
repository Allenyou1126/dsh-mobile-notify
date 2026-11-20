import assert from 'node:assert/strict'
import test from 'node:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { apply, type HostContext } from '../src/index.ts'
import { quietLogger } from './helpers.ts'

interface Route {
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

interface FakeResponse extends ServerResponse {
  status: number
  headers: Record<string, string>
  body: string
}

function makeResponse(): FakeResponse {
  const out = {
    status: 0,
    headers: {} as Record<string, string>,
    body: '',
    writableEnded: false,
    writeHead(status: number, headers?: Record<string, string>) {
      this.status = status
      if (headers !== undefined) this.headers = { ...this.headers, ...headers }
      return this
    },
    end(body?: string | Buffer) {
      if (body !== undefined) this.body += String(body)
      this.writableEnded = true
      return this
    },
  }
  return out as unknown as FakeResponse
}

function makeRequest(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): IncomingMessage {
  const text = body === undefined ? '' : JSON.stringify(body)
  const req = {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)) }),
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
    resume: () => {},
    destroy: () => {},
    async *[Symbol.asyncIterator]() {
      if (text !== '') yield Buffer.from(text)
    },
  }
  return req as unknown as IncomingMessage
}

interface FakeContext {
  ctx: HostContext
  routes: Map<string, Route>
  listeners: Map<string, (...args: unknown[]) => unknown>
  cleanups: Array<() => void>
}

function makeContext(): FakeContext {
  const routes = new Map<string, Route>()
  const listeners = new Map<string, (...args: unknown[]) => unknown>()
  const cleanups: Array<() => void> = []
  const ctx = {
    logger: quietLogger,
    webServer: {
      register(route: Route) {
        routes.set(route.path, route)
        return () => { routes.delete(route.path) }
      },
    },
    connection: {
      requestRejection: () => undefined,
      admit: () => ({ peer: {} }),
      authenticatedUrl: (base: string) => `${base}?token=test`,
    },
    sessions: { get: () => undefined },
    get: () => undefined,
    on: (event: string, listener: (...args: unknown[]) => unknown) => {
      listeners.set(event, listener)
    },
    effect: (callback: () => (() => void) | void) => {
      const cleanup = callback()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
  }
  return { ctx: ctx as unknown as HostContext, routes, listeners, cleanups }
}

test('apply registers seven exact paths (nine method handlers) and three event observers', () => {
  const fake = makeContext()
  apply(fake.ctx, { publicBase: 'https://dsh.example/', transport: 'dryRun' })
  assert.deepEqual([...fake.routes.keys()].sort(), [
    '/mobile/ack',
    '/mobile/bootstrap',
    '/mobile/config',
    '/mobile/health',
    '/mobile/presence',
    '/mobile/push/test',
    '/mobile/settings',
  ])
  assert.deepEqual([...fake.listeners.keys()].sort(), [
    'approval/request',
    'session/event',
    'user-questions/request',
  ])
  for (const cleanup of fake.cleanups.reverse()) cleanup()
})

test('bootstrap redirects to the authenticated URL with no-store headers', async () => {
  const fake = makeContext()
  apply(fake.ctx, { publicBase: 'https://dsh.example/', transport: 'dryRun' })
  const route = fake.routes.get('/mobile/bootstrap')
  assert.ok(route !== undefined)
  const res = makeResponse()
  await route.handler(makeRequest('GET'), res)
  assert.equal(res.status, 302)
  assert.equal(res.headers.location, 'https://dsh.example/?token=test')
  assert.equal(res.headers['cache-control'], 'no-store')
  for (const cleanup of fake.cleanups.reverse()) cleanup()
})

test('presence and health routes work through the fake connection', async () => {
  const fake = makeContext()
  apply(fake.ctx, { publicBase: 'https://dsh.example/', transport: 'dryRun' })
  const presence = fake.routes.get('/mobile/presence')
  const health = fake.routes.get('/mobile/health')
  assert.ok(presence !== undefined && health !== undefined)

  const presenceRes = makeResponse()
  await presence.handler(makeRequest('POST', {
    contract: 1,
    clientId: 'client-1',
    platform: 'web',
    visibility: 'visible',
    focused: true,
    notification: 'granted',
    at: new Date(0).toISOString(),
  }), presenceRes)
  assert.equal(presenceRes.status, 204)

  const healthRes = makeResponse()
  await health.handler(makeRequest('GET'), healthRes)
  assert.equal(healthRes.status, 200)
  const payload = JSON.parse(healthRes.body) as {
    transport: string
    pending: number
    presence: { web: number }
  }
  assert.equal(payload.transport, 'dryRun')
  assert.equal(payload.pending, 0)
  assert.equal(payload.presence.web, 1)
  assert.doesNotMatch(healthRes.body, /sctp|sendkey|publicBase/u)
  for (const cleanup of fake.cleanups.reverse()) cleanup()
})

test('settings route shares one path for GET and PUT', async () => {
  const fake = makeContext()
  apply(fake.ctx, { publicBase: 'https://dsh.example/', transport: 'dryRun' })
  const route = fake.routes.get('/mobile/settings')
  assert.ok(route !== undefined)

  const getRes = makeResponse()
  await route.handler(makeRequest('GET'), getRes)
  assert.equal(getRes.status, 200)
  const view = JSON.parse(getRes.body) as { editable: boolean; settings: object }
  assert.equal(view.editable, false)

  const putRes = makeResponse()
  await route.handler(makeRequest('PUT', { settings: view.settings }), putRes)
  assert.equal(putRes.status, 503)
  for (const cleanup of fake.cleanups.reverse()) cleanup()
})

test('invalid presence JSON is rejected without touching the store', async () => {
  const fake = makeContext()
  apply(fake.ctx, { publicBase: 'https://dsh.example/', transport: 'dryRun' })
  const route = fake.routes.get('/mobile/presence')
  assert.ok(route !== undefined)
  const res = makeResponse()
  await route.handler(makeRequest('POST', { contract: 1, clientId: 'bad id' }), res)
  assert.equal(res.status, 400)
  const healthRes = makeResponse()
  const health = fake.routes.get('/mobile/health')
  assert.ok(health !== undefined)
  await health.handler(makeRequest('GET'), healthRes)
  const payload = JSON.parse(healthRes.body) as { presence: { web: number } }
  assert.equal(payload.presence.web, 0)
  for (const cleanup of fake.cleanups.reverse()) cleanup()
})
