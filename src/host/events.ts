/** Host event observers: approval, user questions, and optional turn completion. */
import type { DecisionEngine } from './decision.ts'
import { cleanText, shortId } from '../shared/text.ts'
import type { Logger, NormalizedEvent } from './types.ts'

interface AgentRef {
  readonly id: string
}

interface ApprovalRequest {
  readonly agent: AgentRef
  readonly toolName?: string
  readonly callId?: string
  readonly reason?: string
  readonly displayReason?: { readonly en?: string; readonly [locale: string]: string | undefined }
}

interface QuestionItem {
  readonly question?: string
  readonly intent?: { readonly kind?: string }
}

interface QuestionRequest {
  readonly agent?: AgentRef
  readonly questions?: readonly QuestionItem[]
  readonly wait?: { readonly callId?: string }
}

interface SessionHeaderLike {
  readonly origin?: 'subagent'
}

interface SessionLike {
  readonly id: string
  readonly header?: SessionHeaderLike
  readonly append?: (type: string, data: unknown) => unknown
}

interface TurnEndEvent {
  readonly type: string
  readonly data?: {
    readonly turn?: number
    readonly reason?: { readonly kind?: string }
  }
}

interface TitleSnapshotLike {
  readonly title?: unknown
}

interface TitleServiceLike {
  get: (session: unknown) => TitleSnapshotLike | undefined
}

export interface EventContext {
  on: {
    (event: 'approval/request', listener: (req: ApprovalRequest, next: () => Promise<unknown>) => Promise<unknown>, prepend?: boolean): void
    (event: 'user-questions/request', listener: (req: QuestionRequest, next: () => Promise<unknown>) => Promise<unknown>, prepend?: boolean): void
    (event: 'session/event', listener: (session: SessionLike, event: TurnEndEvent) => void, prepend?: boolean): void
  }
  sessions: {
    get: (id: string) => SessionLike | undefined
  }
  get: (name: string) => unknown
  logger: Logger
}

function isTitleService(value: unknown): value is TitleServiceLike {
  return typeof value === 'object'
    && value !== null
    && 'get' in value
    && typeof (value as { get?: unknown }).get === 'function'
}

function sessionTitle(ctx: EventContext, sessionId: string): string {
  const service = ctx.get('sessionTitle')
  if (!isTitleService(service)) return shortId(sessionId)
  try {
    const session = ctx.sessions.get(sessionId)
    if (session === undefined) return shortId(sessionId)
    const title = service.get(session)?.title
    if (typeof title === 'string' && title.trim() !== '') return title.trim()
  } catch {
    // A missing/broken title service must not affect notification delivery.
  }
  return shortId(sessionId)
}

function eventId(kind: string, sessionId: string, callId?: string): string {
  return `${sessionId}:${kind}:${callId ?? 'none'}:${Date.now()}`
}

function approvalEvent(ctx: EventContext, req: ApprovalRequest): NormalizedEvent | undefined {
  const sessionId = req.agent?.id
  if (typeof sessionId !== 'string' || sessionId === '') return undefined
  const reason = cleanText(req.reason, 200) ?? cleanText(req.displayReason?.en, 200)
  const toolName = cleanText(req.toolName, 60)
  return {
    eventId: eventId('approval', sessionId, req.callId),
    kind: 'approval',
    sessionId,
    sessionTitle: sessionTitle(ctx, sessionId),
    createdAt: Date.now(),
    ...(typeof req.callId === 'string' && req.callId !== '' ? { callId: req.callId } : {}),
    ...(toolName === undefined ? {} : { toolName }),
    ...(reason === undefined ? {} : { reason }),
  }
}

function questionEvent(ctx: EventContext, req: QuestionRequest): NormalizedEvent | undefined {
  const sessionId = req.agent?.id
  if (typeof sessionId !== 'string' || sessionId === '') return undefined
  const questions = Array.isArray(req.questions) ? req.questions : []
  const planReview = questions.some(question => question.intent?.kind === 'plan-review')
  const firstQuestion = cleanText(questions[0]?.question, 200)
  const callId = typeof req.wait?.callId === 'string' && req.wait.callId !== '' ? req.wait.callId : undefined
  return {
    eventId: eventId(planReview ? 'plan-review' : 'question', sessionId, callId),
    kind: planReview ? 'plan-review' : 'question',
    sessionId,
    sessionTitle: sessionTitle(ctx, sessionId),
    createdAt: Date.now(),
    ...(callId === undefined ? {} : { callId }),
    ...(firstQuestion === undefined ? {} : { question: firstQuestion }),
  }
}

function turnEvent(ctx: EventContext, session: SessionLike, event: TurnEndEvent): NormalizedEvent | undefined {
  if (event.type !== 'turn/end') return undefined
  if (session.header?.origin === 'subagent') return undefined
  const sessionId = session.id
  if (typeof sessionId !== 'string' || sessionId === '') return undefined
  const turn = event.data?.turn
  return {
    eventId: eventId('turn', sessionId),
    kind: 'turn',
    sessionId,
    sessionTitle: sessionTitle(ctx, sessionId),
    createdAt: Date.now(),
    ...(typeof turn === 'number' ? { turn } : {}),
  }
}

/**
 * Register prepend waterfall observers. The approval/question observers never
 * answer and never block: they call `next()` immediately and resolve the
 * decision record when the waterfall returns.
 */
export function registerEventObservers(
  ctx: EventContext,
  engine: DecisionEngine,
  options: { turnDone: (session: SessionLike) => boolean },
): void {
  ctx.on('approval/request', async (req, next) => {
    let event: NormalizedEvent | undefined
    let accepted = false
    try {
      event = approvalEvent(ctx, req)
      if (event !== undefined) accepted = engine.begin(event)
    } catch (error) {
      ctx.logger.warn('dsh-mobile-notify: approval observer failed', error)
    }
    try {
      return await next()
    } finally {
      if (event !== undefined && accepted) {
        try {
          engine.resolve(event)
        } catch (error) {
          ctx.logger.warn('dsh-mobile-notify: approval resolve failed', error)
        }
      }
    }
  }, true)

  ctx.on('user-questions/request', async (req, next) => {
    let event: NormalizedEvent | undefined
    let accepted = false
    try {
      event = questionEvent(ctx, req)
      if (event !== undefined) accepted = engine.begin(event)
    } catch (error) {
      ctx.logger.warn('dsh-mobile-notify: question observer failed', error)
    }
    try {
      return await next()
    } finally {
      if (event !== undefined && accepted) {
        try {
          engine.resolve(event)
        } catch (error) {
          ctx.logger.warn('dsh-mobile-notify: question resolve failed', error)
        }
      }
    }
  }, true)

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return
    let enabled = false
    try {
      enabled = options.turnDone(session)
    } catch (error) {
      ctx.logger.warn('dsh-mobile-notify: turnDone predicate failed', error)
      return
    }
    if (!enabled) return
    try {
      const normalized = turnEvent(ctx, session, event)
      if (normalized !== undefined) {
        // A turn event has no waterfall result; the engine removes it after
        // the push decision because it is marked oneShot.
        engine.begin({ ...normalized, oneShot: true })
      }
    } catch (error) {
      ctx.logger.warn('dsh-mobile-notify: turn observer failed', error)
    }
  })
}
