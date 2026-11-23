/** Exact HTTP routes for the Host half. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { EffectiveConfig } from '../config.ts'
import type { Clock } from './clock.ts'
import type { DecisionEngine } from './decision.ts'
import type { PresenceStore } from './presence.ts'
import { RateLimiter } from './rate-limit.ts'
import { SettingsError, type SettingsService } from './settings.ts'
import type {
  AckInput,
  AckReason,
  AckVia,
  LastPush,
  Logger,
  Platform,
  PresenceInput,
  PushResult,
  Visibility,
} from './types.ts'

export interface RouteWebServer {
  register: (route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse, peer?: unknown) => void | Promise<void>
    /** `required` is the DSH default; named explicitly because the data routes are owner-only. */
    auth?: 'anonymous' | 'required' | 'deny'
  }) => () => void
}

export interface RouteContext {
  webServer: RouteWebServer
}

export interface RoutesDeps {
  config: EffectiveConfig
  presence: PresenceStore
  engine: DecisionEngine
  logger: Logger
  clock: Clock
  version: string
  health: { lastPush?: LastPush }
  settings: SettingsService
  sendTest: (signal: AbortSignal) => Promise<PushResult>
  setSessionTurnDone: (sessionId: string, turnDone: boolean | null) => boolean | Promise<boolean>
  projectionStatus: () => string
}

interface ParseOk<T> { ok: true; value: T }
interface ParseFail { ok: false; message: string }
type ParseResult<T> = ParseOk<T> | ParseFail

const CLIENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u
const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u
const KINDS = ['approval', 'question', 'plan-review', 'turn', 'notice'] as const
const VIA = ['in-page', 'web-notification', 'none'] as const
const REASONS = ['none', 'permission-denied', 'unsupported', 'constructor-error', 'hidden-no-notification'] as const
const PLATFORMS = ['web', 'android-shell'] as const
const VISIBILITIES = ['visible', 'hidden'] as const
const NOTIFICATIONS = ['granted', 'denied', 'default', 'unsupported'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key]
  return typeof value === 'boolean' ? value : undefined
}

function isOneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u001f\u007f]/u.test(value)
}

function parseContract(record: Record<string, unknown>): ParseResult<number> {
  const value = record.contract
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return { ok: false, message: 'contract must be a positive integer' }
  }
  return { ok: true, value }
}

function parseAt(record: Record<string, unknown>): ParseResult<string> {
  const value = readString(record, 'at')
  if (value === undefined || Number.isNaN(Date.parse(value))) {
    return { ok: false, message: 'at must be an RFC3339 timestamp' }
  }
  return { ok: true, value }
}

/** Validate a `POST /mobile/presence` body. */
export function parsePresence(value: unknown): ParseResult<PresenceInput> {
  if (!isRecord(value)) return { ok: false, message: 'body must be a JSON object' }
  const contract = parseContract(value)
  if (!contract.ok) return contract
  const clientId = readString(value, 'clientId')
  if (clientId === undefined || !CLIENT_ID_PATTERN.test(clientId)) {
    return { ok: false, message: 'clientId is invalid' }
  }
  const platform = value.platform
  if (!isOneOf<Platform>(platform, PLATFORMS)) return { ok: false, message: 'platform is invalid' }
  const visibility = value.visibility
  if (!isOneOf<Visibility>(visibility, VISIBILITIES)) {
    return { ok: false, message: 'visibility is invalid' }
  }
  const focused = readBoolean(value, 'focused')
  if (focused === undefined) return { ok: false, message: 'focused must be boolean' }
  const notification = value.notification
  if (!isOneOf(notification, NOTIFICATIONS)) return { ok: false, message: 'notification is invalid' }
  const at = parseAt(value)
  if (!at.ok) return at
  const activeSessionId = readString(value, 'activeSessionId')
  if (activeSessionId !== undefined && !SESSION_ID_PATTERN.test(activeSessionId)) {
    return { ok: false, message: 'activeSessionId is invalid' }
  }
  return {
    ok: true,
    value: {
      clientId,
      platform,
      visibility,
      focused,
      notification,
      at: at.value,
      ...(activeSessionId === undefined ? {} : { activeSessionId }),
    },
  }
}

/** Validate a `PUT /mobile/session-settings` body. */
export function parseSessionTurnDone(value: unknown): ParseResult<{ sessionId: string; turnDone: boolean | null }> {
  if (!isRecord(value)) return { ok: false, message: 'body must be a JSON object' }
  const sessionId = readString(value, 'sessionId')
  if (sessionId === undefined || !SESSION_ID_PATTERN.test(sessionId)) {
    return { ok: false, message: 'sessionId is invalid' }
  }
  const turnDone = value.turnDone
  if (turnDone !== true && turnDone !== false && turnDone !== null) {
    return { ok: false, message: 'turnDone must be boolean or null' }
  }
  return { ok: true, value: { sessionId, turnDone } }
}

/** Validate a `POST /mobile/ack` body. */
export function parseAck(value: unknown): ParseResult<AckInput> {
  if (!isRecord(value)) return { ok: false, message: 'body must be a JSON object' }
  const contract = parseContract(value)
  if (!contract.ok) return contract
  const clientId = readString(value, 'clientId')
  if (clientId === undefined || !CLIENT_ID_PATTERN.test(clientId)) {
    return { ok: false, message: 'clientId is invalid' }
  }
  const platform = value.platform
  if (!isOneOf<Platform>(platform, PLATFORMS)) return { ok: false, message: 'platform is invalid' }
  const sessionId = readString(value, 'sessionId')
  if (sessionId === undefined || !SESSION_ID_PATTERN.test(sessionId)) {
    return { ok: false, message: 'sessionId is invalid' }
  }
  const kind = value.kind
  if (!isOneOf(kind, KINDS)) return { ok: false, message: 'kind is invalid' }
  const key = readString(value, 'key')
  if (key === undefined || key.length === 0 || key.length > 256 || hasControlCharacters(key)) {
    return { ok: false, message: 'key is invalid' }
  }
  const callId = readString(value, 'callId')
  if (callId !== undefined && (callId.length === 0 || callId.length > 128 || hasControlCharacters(callId))) {
    return { ok: false, message: 'callId is invalid' }
  }
  const delivered = readBoolean(value, 'delivered')
  if (delivered === undefined) return { ok: false, message: 'delivered must be boolean' }
  const via = value.via
  if (!isOneOf<AckVia>(via, VIA)) return { ok: false, message: 'via is invalid' }
  const reason = value.reason
  if (!isOneOf<AckReason>(reason, REASONS)) return { ok: false, message: 'reason is invalid' }
  if (delivered && (via === 'none' || reason !== 'none')) {
    return { ok: false, message: 'delivered ack must use a delivery channel and reason=none' }
  }
  if (!delivered && (via !== 'none' || reason === 'none')) {
    return { ok: false, message: 'failed ack must use via=none and a failure reason' }
  }
  const at = parseAt(value)
  if (!at.ok) return at
  return {
    ok: true,
    value: {
      clientId,
      platform,
      sessionId,
      kind,
      key,
      delivered,
      via,
      reason,
      at: at.value,
      ...(callId === undefined ? {} : { callId }),
    },
  }
}

function headerValue(value: IncomingMessage['headers'][string]): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0]
  return undefined
}

function jsonContentType(req: IncomingMessage): boolean {
  const type = headerValue(req.headers['content-type'])?.split(';')[0]?.trim().toLowerCase()
  return type === 'application/json'
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, status: number, error: string, message?: string): void {
  sendJson(res, status, message === undefined ? { error } : { error, message })
}

function sendEmpty(res: ServerResponse, status: number): void {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end()
}

function sendRateLimited(res: ServerResponse): void {
  res.writeHead(429, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'retry-after': '60',
  })
  res.end(JSON.stringify({ error: 'rate_limited' }))
}

function sendMethodNotAllowed(res: ServerResponse, allow: string): void {
  res.writeHead(405, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    allow,
  })
  res.end(JSON.stringify({ error: 'method_not_allowed' }))
}

async function readJson(req: IncomingMessage, res: ServerResponse, maxBytes: number): Promise<ParseResult<unknown>> {
  if (!jsonContentType(req)) {
    sendError(res, 415, 'unsupported_media_type')
    req.resume()
    return { ok: false, message: 'unsupported media type' }
  }
  const declared = Number(headerValue(req.headers['content-length']) ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    sendError(res, 413, 'payload_too_large')
    req.resume()
    return { ok: false, message: 'payload too large' }
  }
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
      size += buffer.length
      if (size > maxBytes) {
        sendError(res, 413, 'payload_too_large')
        req.destroy()
        return { ok: false, message: 'payload too large' }
      }
      chunks.push(buffer)
    }
  } catch {
    if (!res.writableEnded) sendError(res, 400, 'invalid_request')
    return { ok: false, message: 'body read failed' }
  }
  if (size === 0) return { ok: false, message: 'body is empty' }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown }
  } catch {
    sendError(res, 400, 'invalid_request', 'body must be valid JSON')
    return { ok: false, message: 'invalid json' }
  }
}

function ipKey(req: IncomingMessage): string {
  return `ip:${req.socket.remoteAddress ?? 'unknown'}`
}

function bootstrap(res: ServerResponse, deps: RoutesDeps): void {
  // DSH 0.2.3 removed Connection.authenticatedUrl. This route carries no
  // credential of its own and stays anonymous, like the old token-less
  // redirect: the configured publicBase is the deployment entry to resume.
  try {
    const location = new URL(deps.config.publicBase).toString()
    res.writeHead(302, {
      location,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    })
    res.end()
  } catch (error) {
    deps.logger.error('dsh-mobile-notify: bootstrap failed', error)
    sendError(res, 500, 'internal_error')
  }
}

function clientConfig(config: EffectiveConfig): unknown {
  return {
    contract: 1,
    client: {
      inPage: config.notify.inPage,
      webNotification: config.notify.webNotification,
      inPageCountsAsDelivered: config.notify.inPageCountsAsDelivered,
      turnDone: config.notify.turnDone,
      settleMs: config.notify.settleMs,
      detail: config.notify.detail,
      includeSessionTitle: config.privacy.includeSessionTitle,
      includeReason: config.privacy.includeReason,
      includeToolName: config.privacy.includeToolName,
    },
  }
}

function health(config: EffectiveConfig, deps: RoutesDeps): unknown {
  return {
    ok: true,
    contract: 1,
    version: deps.version,
    transport: config.transport,
    pending: deps.engine.pendingCount,
    presence: mapPresence(deps.presence.counts()),
    projection: deps.projectionStatus(),
    lastPush: deps.health.lastPush ?? null,
  }
}

function mapPresence(counts: { web: number; androidShell: number }): { web: number; androidShell: number } {
  return { web: counts.web, androidShell: counts.androidShell }
}

/**
 * Register every `/mobile/*` route and return one idempotent disposer.
 * The caller owns disposal through a Cordis effect.
 */
export function registerRoutes(context: RouteContext, deps: RoutesDeps): () => void {
  const ipLimiter = new RateLimiter(deps.clock)
  const clientLimiter = new RateLimiter(deps.clock)
  const pushLimiter = new RateLimiter(deps.clock)
  const settingsLimiter = new RateLimiter(deps.clock)
  const disposers: Array<() => void> = []

  type RouteMethod = 'GET' | 'POST' | 'PUT'
  type RouteRunner = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
  type RouteAuth = 'anonymous' | 'required'
  const handlersByPath = new Map<string, { handlers: Partial<Record<RouteMethod, RouteRunner>> }>()

  // DSH permits one exact route per pathname, so methods share one registration.
  const register = (method: RouteMethod, path: string, run: RouteRunner, auth: RouteAuth = 'required'): void => {
    const existing = handlersByPath.get(path)
    if (existing !== undefined) {
      existing.handlers[method] = run
      return
    }
    const handlers: Partial<Record<RouteMethod, RouteRunner>> = { [method]: run }
    handlersByPath.set(path, { handlers })
    disposers.push(context.webServer.register({
      kind: 'exact',
      path,
      auth,
      handler: async (req, res) => {
        try {
          const runner = req.method === undefined ? undefined : handlers[req.method as RouteMethod]
          if (runner === undefined) {
            sendMethodNotAllowed(res, Object.keys(handlers).join(', '))
            req.resume()
            return
          }
          if (!ipLimiter.take(ipKey(req), 240, 60_000)) {
            sendRateLimited(res)
            req.resume()
            return
          }
          ipLimiter.prune(60_000)
          await runner(req, res)
        } catch (error) {
          deps.logger.error(`dsh-mobile-notify: ${req.method ?? '?'} ${path} failed`, error)
          if (!res.writableEnded) sendError(res, 500, 'internal_error')
        }
      },
    }))
  }

  try {
  // The old route carried no token and was reachable without a DSH session; it
  // stays anonymous because it only forwards to the configured deployment URL.
  register('GET', '/mobile/bootstrap', (_req, res) => {
    bootstrap(res, deps)
  }, 'anonymous')

  register('GET', '/mobile/config', (req, res) => {
    sendJson(res, 200, clientConfig(deps.config))
  })

  register('POST', '/mobile/presence', async (req, res) => {
    const body = await readJson(req, res, deps.config.limits.bodyBytes)
    if (!body.ok) {
      if (!res.writableEnded) sendError(res, 400, 'invalid_request', body.message)
      return
    }
    const parsed = parsePresence(body.value)
    if (!parsed.ok) {
      sendError(res, 400, 'invalid_request', parsed.message)
      return
    }
    if (!clientLimiter.take(`client:${parsed.value.clientId}`, deps.config.limits.ratePerMinute, 60_000)) {
      sendRateLimited(res)
      return
    }
    deps.presence.update(parsed.value)
    sendEmpty(res, 204)
  })

  register('POST', '/mobile/ack', async (req, res) => {
    const body = await readJson(req, res, deps.config.limits.bodyBytes)
    if (!body.ok) {
      if (!res.writableEnded) sendError(res, 400, 'invalid_request', body.message)
      return
    }
    const parsed = parseAck(body.value)
    if (!parsed.ok) {
      sendError(res, 400, 'invalid_request', parsed.message)
      return
    }
    if (!clientLimiter.take(`client:${parsed.value.clientId}`, deps.config.limits.ratePerMinute, 60_000)) {
      sendRateLimited(res)
      return
    }
    deps.engine.onAck(parsed.value)
    sendEmpty(res, 204)
  })

  register('POST', '/mobile/push/test', async (req, res) => {
    // The route takes no body; drain an unexpected one so keep-alive stays sane.
    req.resume()
    if (!pushLimiter.take('push-test', 10, 60_000)) {
      sendRateLimited(res)
      return
    }
    const controller = new AbortController()
    const result = await deps.sendTest(controller.signal)
    deps.health.lastPush = {
      at: new Date().toISOString(),
      ok: result.ok,
      kind: 'test',
    }
    if (result.ok) sendJson(res, 202, { ok: true, dryRun: result.dryRun })
    else sendError(res, 502, 'upstream_failed', result.error)
  })

  register('GET', '/mobile/health', (req, res) => {
    sendJson(res, 200, health(deps.config, deps))
  })

  register('PUT', '/mobile/session-settings', async (req, res) => {
    if (!settingsLimiter.take(ipKey(req), 20, 60_000)) {
      sendRateLimited(res)
      req.resume()
      return
    }
    const body = await readJson(req, res, 4096)
    if (!body.ok) {
      if (!res.writableEnded) sendError(res, 400, 'invalid_request', body.message)
      return
    }
    const parsed = parseSessionTurnDone(body.value)
    if (!parsed.ok) {
      sendError(res, 400, 'invalid_request', parsed.message)
      return
    }
    const changed = await deps.setSessionTurnDone(parsed.value.sessionId, parsed.value.turnDone)
    if (!changed) {
      sendError(res, 404, 'session_not_found')
      return
    }
    sendJson(res, 200, { ok: true, sessionId: parsed.value.sessionId, turnDone: parsed.value.turnDone })
  })

  register('GET', '/mobile/settings', async (req, res) => {
    const view = await deps.settings.read()
    sendJson(res, 200, view)
  })

  register('PUT', '/mobile/settings', async (req, res) => {
    if (!settingsLimiter.take(ipKey(req), 20, 60_000)) {
      sendRateLimited(res)
      req.resume()
      return
    }
    const body = await readJson(req, res, 16_384)
    if (!body.ok) {
      if (!res.writableEnded) sendError(res, 400, 'invalid_request', body.message)
      return
    }
    try {
      const result = await deps.settings.write(body.value as Parameters<SettingsService['write']>[0])
      sendJson(res, 200, result)
    } catch (error) {
      if (error instanceof SettingsError) {
        sendError(res, error.status, error.status === 400 ? 'invalid_settings' : 'settings_unavailable', error.message)
        return
      }
      throw error
    }
  })

  } catch (error) {
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch {
        // A failed registration must not leave earlier routes behind.
      }
    }
    throw error
  }

  return () => {
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch {
        // Route disposal is best effort during plugin reload.
      }
    }
  }
}

/** Exported for route unit tests. */
export const __test = {
  readJson,
  sendJson,
  sendError,
  sendEmpty,
  ipKey,
  clientConfig,
  health,
  parseSessionTurnDone,
  jsonContentType,
  headerValue,
}
