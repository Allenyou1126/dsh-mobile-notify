/** Model-facing `mobile_notify` tool: queue a notice through the same web-first flow as events. */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { EffectiveConfig } from '../config.ts'
import { cleanMultiline, cleanText } from '../shared/text.ts'
import type { Clock } from './clock.ts'
import type { DecisionEngine } from './decision.ts'
import type { SessionAppendLike, SessionState } from './session-state.ts'
import type { Logger, NormalizedEvent } from './types.ts'

const TITLE_MAX = 60
const BODY_MAX = 1000
const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u

/** The subset of `ctx.tools` this plugin needs, kept structural for Host tests. */
export interface ToolsServiceLike {
  register: (definition: ToolDefinition) => () => void
}

export interface NotifyToolDeps {
  readonly config: EffectiveConfig
  readonly engine: DecisionEngine
  readonly sessionState: SessionState
  readonly logger: Logger
  readonly clock: Clock
}

function toolsOf(ctx: { get: (name: string) => unknown }): ToolsServiceLike | undefined {
  const candidate = ctx.get('tools')
  if (typeof candidate !== 'object' || candidate === null) return undefined
  if (typeof (candidate as { register?: unknown }).register !== 'function') return undefined
  return candidate as unknown as ToolsServiceLike
}

function requireTitle(value: unknown): string {
  if (typeof value !== 'string') throw new Error('title must be a string')
  const raw = value.trim()
  if (raw === '') throw new Error('title must not be empty')
  if (Array.from(raw).length > TITLE_MAX) {
    throw new Error(`title must be at most ${TITLE_MAX} characters`)
  }
  const cleaned = cleanText(raw, TITLE_MAX)
  if (cleaned === undefined) throw new Error('title must not be empty')
  return cleaned
}

function optionalBody(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error('body must be a string')
  if (Array.from(value.trim()).length > BODY_MAX) {
    throw new Error(`body must be at most ${BODY_MAX} characters`)
  }
  return cleanMultiline(value, BODY_MAX)
}

function callingSession(agent: unknown): SessionAppendLike | undefined {
  if (typeof agent !== 'object' || agent === null) return undefined
  const session = (agent as { session?: unknown }).session
  if (typeof session !== 'object' || session === null) return undefined
  const candidate = session as { id?: unknown; append?: unknown }
  if (typeof candidate.id !== 'string' || !SESSION_ID_PATTERN.test(candidate.id)) return undefined
  if (typeof candidate.append !== 'function') return undefined
  return candidate as unknown as SessionAppendLike
}

/** Build one model notification event; shared with tests. */
export function createNotifyToolDefinition(deps: NotifyToolDeps): ToolDefinition {
  return defineTool({
    name: 'mobile_notify',
    description:
      'Queue a notification through the same web-first flow as approval/question reminders: the open page '
      + 'gets the in-page card or browser notification first, and Server酱³ is only a fallback. Use it only '
      + 'when the user explicitly asks to be notified, or when the user asked to hear about a long-running '
      + 'result. The title is prefixed with "DSH ·"; body line breaks are preserved. The notice follows the '
      + 'configured detail/privacy level, debounce/grace timing, presence/ack, and push rate limits.',
    parameters: {
      title: {
        type: 'string',
        required: true,
        description: `Short notification title, at most ${TITLE_MAX} characters. Do not include secrets.`,
      },
      body: {
        type: 'string',
        description:
          `Plain-text notification body, at most ${BODY_MAX} characters. Line breaks are preserved. `
          + 'Defaults to the title.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          queued: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: value.queued
          ? `Notification queued through the web-first flow: ${args.title}`
          : `Notification was not queued: ${args.title}`,
      }],
    },
    async execute(args, exec) {
      const title = requireTitle(args.title)
      const body = optionalBody(args.body)
      const session = callingSession(exec.agent)
      const createdAt = deps.clock.now()
      const key = `notice-${createdAt}-${Math.random().toString(36).slice(2, 10)}`
      const event: NormalizedEvent = {
        eventId: key,
        kind: 'notice',
        sessionId: session?.id ?? '',
        callId: key,
        sessionTitle: '',
        noticeTitle: title,
        ...(body === undefined ? {} : { noticeBody: body }),
        createdAt,
        oneShot: true,
      }
      if (!deps.engine.begin(event)) {
        throw new Error('mobile_notify could not start: notification tool is disabled or already pending')
      }
      try {
        if (session !== undefined) {
          deps.sessionState.appendNotice(session, {
            key,
            title,
            ...(body === undefined ? {} : { body }),
            createdAt,
          })
        }
      } catch (error) {
        deps.engine.resolve(event)
        throw error
      }
      return { ok: true, queued: true }
    },
  })
}

/**
 * Register the tool when enabled. A missing tools service is non-fatal: the
 * approval/question notification paths must keep working in a Host without it.
 */
export function registerNotifyTool(
  ctx: { get: (name: string) => unknown },
  deps: NotifyToolDeps,
): (() => void) | undefined {
  if (!deps.config.notify.modelTool) return undefined
  const tools = toolsOf(ctx)
  if (tools === undefined) {
    deps.logger.warn('dsh-mobile-notify: tools service missing; mobile_notify was not registered')
    return undefined
  }
  try {
    return tools.register(createNotifyToolDefinition(deps))
  } catch (error) {
    // A name collision or invalid registration must not disable approvals/questions.
    deps.logger.warn('dsh-mobile-notify: mobile_notify registration failed', error)
    return undefined
  }
}
