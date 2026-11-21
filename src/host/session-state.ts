/** Durable per-session model-notice and turn-done state, exposed through a Session projection. */
import { appendPluginRecord } from '@deepseek-ai/dsh-session'
import type { Logger } from './types.ts'

export const MOBILE_NOTIFY_PROJECTION = 'mobileNotify'
export const NOTICE_EVENT = 'plugin:dsh-mobile-notify/notice'
export const NOTICE_CLEAR_EVENT = 'plugin:dsh-mobile-notify/clear'
export const TURN_DONE_EVENT = 'plugin:dsh-mobile-notify/turn-done'

export interface MobileNotice {
  readonly key: string
  readonly title: string
  readonly body?: string
  readonly createdAt: number
}

export interface MobileSessionState {
  readonly notice: MobileNotice | null
  /** null follows the global `notify.turnDone` default; boolean is this Session's override. */
  readonly turnDone: boolean | null
}

interface SessionProjectionHandleLike {
  stateOf(session: unknown): unknown
}

interface SessionProjectionsLike {
  register(definition: unknown): Promise<SessionProjectionHandleLike>
}

export interface SessionAppendLike {
  readonly id: string
}

/** Append one ignorable plugin record; injectable for tests. */
export type AppendRecord = (session: unknown, type: string, data: unknown) => unknown

const defaultAppendRecord = appendPluginRecord as unknown as AppendRecord

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '' || Array.from(trimmed).length > max) return undefined
  return trimmed
}

function parseNotice(value: unknown): MobileNotice | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value)) throw new Error('notice must be an object or null')
  const key = nonEmptyString(value.key, 128)
  const title = nonEmptyString(value.title, 80)
  const createdAt = value.createdAt
  if (key === undefined) throw new Error('notice.key is invalid')
  if (title === undefined) throw new Error('notice.title is invalid')
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    throw new Error('notice.createdAt is invalid')
  }
  const body = value.body === undefined ? undefined : nonEmptyString(value.body, 1200)
  return { key, title, createdAt, ...(body === undefined ? {} : { body }) }
}

/** Validate persisted projection state before it seeds a fold. */
function parseState(value: unknown): MobileSessionState {
  if (!isRecord(value)) throw new Error('mobile state must be an object')
  const notice = parseNotice(value.notice)
  const turnDone = value.turnDone
  if (turnDone !== null && turnDone !== undefined && typeof turnDone !== 'boolean') {
    throw new Error('mobile state turnDone must be boolean or null')
  }
  return { notice, turnDone: turnDone === true ? true : turnDone === false ? false : null }
}

const stateSchema = { parse: parseState }

function noticeFromEvent(value: unknown): MobileNotice | null {
  return parseNotice(value)
}

function eventTurnDone(value: unknown): boolean | null {
  if (!isRecord(value)) throw new Error('turn-done event must be an object')
  const turnDone = value.turnDone
  if (turnDone !== true && turnDone !== false && turnDone !== null) {
    throw new Error('turn-done event must carry boolean or null')
  }
  return turnDone
}

/** Projection-backed state service; falls back to no overrides when unavailable. */
export type SessionStateStatus = 'missing' | 'registering' | 'ready' | 'error'

export interface SessionState {
  readonly appendNotice: (session: SessionAppendLike, notice: MobileNotice) => void
  readonly clearNotice: (session: SessionAppendLike, key: string) => void
  readonly setTurnDone: (session: SessionAppendLike, turnDone: boolean | null) => void
  readonly turnDoneFor: (session: unknown) => boolean | null
  readonly status: () => SessionStateStatus
}

export function createSessionState(
  ctx: { get: (name: string) => unknown },
  logger: Logger,
  appendRecord: AppendRecord = defaultAppendRecord,
): SessionState {
  const candidate = ctx.get('sessionProjections')
  if (
    typeof candidate !== 'object'
    || candidate === null
    || typeof (candidate as { register?: unknown }).register !== 'function'
  ) {
    logger.warn('dsh-mobile-notify: sessionProjections missing; notices cannot reach the web UI')
    return {
      appendNotice: () => {},
      clearNotice: () => {},
      setTurnDone: () => {},
      turnDoneFor: () => null,
      status: () => 'missing',
    }
  }
  const registry = candidate as unknown as SessionProjectionsLike
  let handle: SessionProjectionHandleLike | undefined
  let status: SessionStateStatus = 'registering'
  const ready = registry.register({
    key: MOBILE_NOTIFY_PROJECTION,
    stateSchema,
    init: () => ({ notice: null, turnDone: null }),
    apply: (state: MobileSessionState, event: { type: string; data?: unknown }) => {
      if (event.type === NOTICE_EVENT) {
        return { ...state, notice: noticeFromEvent(event.data) }
      }
      if (event.type === NOTICE_CLEAR_EVENT) {
        const data = isRecord(event.data) ? event.data : {}
        return state.notice !== null && state.notice.key === data.key
          ? { ...state, notice: null }
          : state
      }
      if (event.type === TURN_DONE_EVENT) {
        return { ...state, turnDone: eventTurnDone(event.data) }
      }
      return state
    },
    wire: {
      viewSchema: stateSchema,
      view: (state: MobileSessionState) => state,
      summary: true,
    },
    stateVersion: 1,
  } as never)
  void ready.then(
    value => {
      handle = value
      status = 'ready'
    },
    (error: unknown) => {
      status = 'error'
      logger.warn('dsh-mobile-notify: session projection registration failed', error)
    },
  )

  return {
    appendNotice: (session, notice) => {
      appendRecord(session, NOTICE_EVENT, notice)
    },
    clearNotice: (session, key) => {
      appendRecord(session, NOTICE_CLEAR_EVENT, { key })
    },
    setTurnDone: (session, turnDone) => {
      appendRecord(session, TURN_DONE_EVENT, { turnDone })
    },
    turnDoneFor: (session) => {
      if (handle === undefined) return null
      try {
        const state = parseState(handle.stateOf(session))
        return state.turnDone
      } catch {
        return null
      }
    },
    status: () => status,
  }
}
