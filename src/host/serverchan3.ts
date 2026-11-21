/** Server酱³ HTTP adapter and pure payload builder. */
import type { DetailLevel, EffectiveConfig } from '../config.ts'
import { sleep, type Clock } from './clock.ts'
import { RateLimiter } from './rate-limit.ts'
import { buildTags } from '../shared/tags.ts'
import { isSendkey, uidFromSendkey } from '../shared/serverchan.ts'
import { cleanMultiline, cleanText, escapeMarkdown, shortId, truncate } from '../shared/text.ts'
import type { Logger, NormalizedEvent, PushResult, Transport } from './types.ts'

const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u
const FALLBACK_LABEL = '打开 DSH'

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

interface Payload {
  title: string
  desp: string
  short: string
  tags?: string
}

export interface BuiltPayload {
  payload: Payload
  droppedTags: string[]
}

export interface ServerChanTransportDeps {
  readonly config: EffectiveConfig
  readonly logger: Logger
  readonly clock: Clock
  /** Resolve the stored SendKey per send so rotation works without a restart. */
  readonly sendkey: () => Promise<string | undefined>
  readonly fetchImpl?: FetchLike
  readonly limiter?: RateLimiter
}

function noticeTitle(event: NormalizedEvent): string {
  const title = cleanOrEmpty(event.noticeTitle, 60)
  const base = title === '' ? '通知' : title
  return base.startsWith('DSH') ? base : `DSH · ${base}`
}

function titleFor(event: NormalizedEvent, detail: DetailLevel): string {
  if (event.kind === 'notice') return noticeTitle(event)
  const kind = event.kind
  if (detail === 'generic') {
    return kind === 'turn' ? 'DSH · 任务完成' : kind === 'test' ? 'DSH · 测试通知' : 'DSH · 有待处理提醒'
  }
  switch (kind) {
    case 'approval': return 'DSH · 需要审批'
    case 'question': return 'DSH · 需要回答'
    case 'plan-review': return 'DSH · 需要确认计划'
    case 'turn': return 'DSH · 任务完成'
    case 'test': return 'DSH · 测试通知'
  }
}

function genericShort(kind: NormalizedEvent['kind']): string {
  if (kind === 'turn') return 'DSH 本轮任务完成'
  if (kind === 'test') return '这是一条测试推送'
  if (kind === 'notice') return 'DSH 通知'
  return 'DSH 有待处理提醒'
}

function detailFor(config: EffectiveConfig): DetailLevel {
  return config.notify.detail
}

function includeSession(event: NormalizedEvent, config: EffectiveConfig): boolean {
  return detailFor(config) !== 'generic'
    && config.privacy.includeSessionTitle
    && event.sessionTitle !== ''
}

function includeDetail(event: NormalizedEvent, config: EffectiveConfig): boolean {
  return detailFor(config) === 'summary'
    && (config.privacy.includeReason || config.privacy.includeToolName)
}

function cleanOrEmpty(value: string | undefined, max: number): string {
  return cleanText(value, max) ?? ''
}

function buildShort(event: NormalizedEvent, config: EffectiveConfig): string {
  if (event.kind === 'notice') {
    const body = cleanOrEmpty(event.noticeBody, 100)
    return body === '' ? noticeTitle(event) : body
  }
  const detail = detailFor(config)
  if (detail === 'generic' || event.kind === 'test') return genericShort(event.kind)
  const parts: string[] = []
  if (includeSession(event, config)) parts.push(event.sessionTitle)
  if (detail === 'summary' && config.privacy.includeToolName) {
    const tool = cleanOrEmpty(event.toolName, 60)
    if (tool !== '') parts.push(tool)
  }
  if (detail === 'summary' && config.privacy.includeReason) {
    const text = cleanOrEmpty(event.kind === 'question' || event.kind === 'plan-review'
      ? event.question
      : event.reason, 100)
    if (text !== '') parts.push(text)
  }
  if (parts.length === 0) parts.push(genericShort(event.kind))
  return truncate(parts.join(' · '), 100)
}

/** Build the single-line `scopen://` link, or undefined for an invalid session id. */
export function buildScopenUrl(event: NormalizedEvent, config: EffectiveConfig): string | undefined {
  if (event.kind === 'test' || event.sessionId === '') return undefined
  if (!SESSION_ID_PATTERN.test(event.sessionId)) return undefined
  const requestId = event.callId ?? (event.turn === undefined ? undefined : String(event.turn))
  const params: Array<readonly [string, string]> = [
    ['sessionId', event.sessionId],
    ['kind', event.kind],
    ...(requestId === undefined || requestId === '' ? [] : [['requestId', requestId] as const]),
    ['sc.market', '0'],
    ['sc.fallback', config.serverchan3.fallbackUrl],
  ]
  // Encode every value exactly once; do not use URLSearchParams (spaces become '+').
  return `scopen://${config.serverchan3.appPackage}?${params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`
}

function linkLine(event: NormalizedEvent, config: EffectiveConfig): string {
  const deepLink = buildScopenUrl(event, config)
  const target = deepLink ?? config.serverchan3.fallbackUrl
  return `[${FALLBACK_LABEL}](${target})`
}

function buildDesp(event: NormalizedEvent, config: EffectiveConfig): string {
  if (event.kind === 'test') {
    return `这是一条来自 DeepSeek Harness 的测试推送。\n\n${linkLine(event, config)}`
  }
  if (event.kind === 'notice') {
    const body = cleanMultiline(event.noticeBody, 1000)
    const lines = body === undefined ? [] : [escapeMarkdown(body), '']
    lines.push(linkLine(event, config))
    return lines.join('\n')
  }
  const detail = detailFor(config)
  const lines: string[] = []
  if (includeSession(event, config)) {
    lines.push(`**会话**：${escapeMarkdown(cleanOrEmpty(event.sessionTitle, 80))}`)
    lines.push('')
  }
  if (detail === 'summary' && includeDetail(event, config)) {
    if (config.privacy.includeToolName && event.toolName !== undefined) {
      const tool = cleanOrEmpty(event.toolName, 60)
      if (tool !== '') lines.push(`**工具**：${escapeMarkdown(tool)}`)
    }
    if (config.privacy.includeReason) {
      const text = cleanOrEmpty(
        event.kind === 'question' || event.kind === 'plan-review' ? event.question : event.reason,
        200,
      )
      if (text !== '') {
        lines.push(`${event.kind === 'question' || event.kind === 'plan-review' ? '**问题**' : '**原因**'}：${escapeMarkdown(text)}`)
      }
    }
    if (event.kind === 'turn') lines.push('**状态**：本轮已完成')
  } else {
    lines.push(genericShort(event.kind))
  }
  lines.push('')
  lines.push(linkLine(event, config))
  return lines.join('\n')
}

/** Pure payload builder; useful in tests and in dry-run logs. */
export function buildPayload(event: NormalizedEvent, config: EffectiveConfig): BuiltPayload {
  const { tags, dropped } = buildTags(event.kind, config.serverchan3.tags)
  const payload: Payload = {
    title: titleFor(event, config.notify.detail),
    desp: buildDesp(event, config),
    short: buildShort(event, config),
  }
  const joined = tags.length === 0 ? undefined : tags.join('|')
  if (joined !== undefined) payload.tags = joined
  return { payload, droppedTags: dropped }
}

export class ServerChanTransport implements Transport {
  private readonly deps: ServerChanTransportDeps
  private readonly fetchImpl: FetchLike
  private readonly limiter: RateLimiter

  public constructor(deps: ServerChanTransportDeps) {
    this.deps = deps
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.limiter = deps.limiter ?? new RateLimiter(deps.clock)
  }

  public async send(event: NormalizedEvent, signal: AbortSignal): Promise<PushResult> {
    const config = this.deps.config
    const built = buildPayload(event, config)
    if (built.droppedTags.length > 0) {
      this.deps.logger.warn(
        `dsh-mobile-notify: dropped invalid tags: ${built.droppedTags.map(tag => `"${tag}"`).join(', ')}`,
      )
    }
    if (config.transport === 'dryRun') {
      this.deps.logger.info(
        `dsh-mobile-notify: dryRun push ${event.kind} ${shortId(event.sessionId)} tags=${built.payload.tags ?? '(none)'}`,
      )
      return { ok: true, dryRun: true }
    }

    const sendkey = await this.deps.sendkey()
    if (!isSendkey(sendkey)) {
      return { ok: false, dryRun: false, error: 'serverchan3 credentials missing' }
    }
    const uid = uidFromSendkey(sendkey)
    if (uid === undefined) {
      return { ok: false, dryRun: false, error: 'serverchan3 uid missing from SendKey' }
    }
    if (!this.limiter.take('push', config.limits.pushPerMinute, 60_000)) {
      this.deps.logger.warn('dsh-mobile-notify: outbound push rate limit reached')
      return { ok: false, dryRun: false, error: 'rate_limited' }
    }

    const endpoint = `https://${uid}.push.ft07.com/send/${sendkey}.send`
    const attempts = config.limits.pushRetries + 1
    let lastError = 'unknown'
    let lastStatus: number | undefined
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (signal.aborted) return { ok: false, dryRun: false, error: 'aborted' }
      try {
        const response = await this.post(endpoint, built.payload, signal)
        lastStatus = response.status
        if (response.ok) {
          const body = await response.text().catch(() => '')
          const code = parseResponseCode(body)
          if (code === undefined || code === 0) return { ok: true, dryRun: false, status: response.status }
          lastError = `upstream code ${code}`
        } else {
          lastError = `http ${response.status}`
        }
        if (!isRetryable(response.status) || attempt + 1 >= attempts) break
      } catch (error) {
        if (signal.aborted) return { ok: false, dryRun: false, error: 'aborted' }
        const message = error instanceof Error ? error.message : 'network error'
        lastError = redactSecret(message, sendkey)
      }
      if (attempt + 1 < attempts) await sleep(attempt === 0 ? 500 : 1500)
    }
    this.deps.logger.warn(
      `dsh-mobile-notify: serverchan3 push failed kind=${event.kind} session=${shortId(event.sessionId)} status=${lastStatus ?? 'n/a'} error=${lastError}`,
    )
    return { ok: false, dryRun: false, status: lastStatus, error: lastError }
  }

  /** Send a generic test push; tags still use the configured test tag. */
  public sendTest(signal: AbortSignal): Promise<PushResult> {
    const event: NormalizedEvent = {
      eventId: 'test',
      kind: 'test',
      sessionId: 'test',
      sessionTitle: '',
      createdAt: Date.now(),
    }
    return this.send(event, signal)
  }

  private async post(endpoint: string, payload: Payload, external: AbortSignal): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.deps.config.limits.pushTimeoutMs)
    ;(timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.()
    const onAbort = (): void => controller.abort()
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', onAbort, { once: true })
    try {
      return await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
      external.removeEventListener('abort', onAbort)
    }
  }
}

function parseResponseCode(body: string): number | undefined {
  if (body.trim() === '') return undefined
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const code = (parsed as { code?: unknown }).code
    return typeof code === 'number' ? code : undefined
  } catch {
    return undefined
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

/** Never let a transport error carry the SendKey into logs or a route response. */
function redactSecret(value: string, secret: string): string {
  if (secret === '') return value
  return value.split(secret).join('***')
}
