/** Model-facing `mobile_notify` tool: explicit, direct notification pushes. */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { EffectiveConfig } from '../config.ts'
import { cleanMultiline, cleanText } from '../shared/text.ts'
import type { Clock } from './clock.ts'
import type { Logger, NormalizedEvent, PushResult, Transport } from './types.ts'

const TITLE_MAX = 60
const BODY_MAX = 1000
const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u

/** The subset of `ctx.tools` this plugin needs, kept structural for Host tests. */
export interface ToolsServiceLike {
  register: (definition: ToolDefinition) => () => void
}

export interface NotifyToolDeps {
  readonly config: EffectiveConfig
  readonly transport: Transport
  readonly logger: Logger
  readonly clock: Clock
  /** Receive every attempted push so `/mobile/health` can report it. */
  readonly onPushResult?: (result: PushResult) => void
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

/** Use the calling session for the `scopen` link when it is valid; otherwise omit the link. */
function sessionIdOf(agent: unknown): string {
  if (typeof agent !== 'object' || agent === null) return ''
  const session = (agent as { session?: { id?: unknown } }).session
  const id = session?.id
  return typeof id === 'string' && SESSION_ID_PATTERN.test(id) ? id : ''
}

/** Build one model notification event; shared with tests. */
export function createNotifyToolDefinition(deps: NotifyToolDeps): ToolDefinition {
  return defineTool({
    name: 'mobile_notify',
    description:
      'Send a notification through the configured mobile-notify transport (Server酱³, or dryRun). '
      + 'Use it only when the user explicitly asks to be notified, or when the user asked to hear about '
      + 'a long-running result. This sends immediately and does not use the approval/question web-first '
      + 'fallback. The title is prefixed with "DSH ·"; body line breaks are preserved. Returns dryRun '
      + 'when the transport recorded the message without sending it.',
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
          dryRun: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: value.dryRun
          ? `Notification recorded in dryRun (nothing sent): ${args.title}`
          : `Notification sent: ${args.title}`,
      }],
    },
    timeoutMs: deps.config.limits.pushTimeoutMs * (deps.config.limits.pushRetries + 1) + 5_000,
    async execute(args, exec) {
      const title = requireTitle(args.title)
      const body = optionalBody(args.body)
      const event: NormalizedEvent = {
        eventId: `notice:${deps.clock.now()}`,
        kind: 'notice',
        sessionId: sessionIdOf(exec.agent),
        sessionTitle: '',
        noticeTitle: title,
        ...(body === undefined ? {} : { noticeBody: body }),
        createdAt: deps.clock.now(),
      }
      const result = await deps.transport.send(event, exec.signal)
      deps.onPushResult?.(result)
      if (!result.ok) {
        throw new Error(`mobile_notify failed: ${result.error ?? 'unknown error'}`)
      }
      return { ok: true, dryRun: result.dryRun }
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
