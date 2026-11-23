/** dsh-mobile-notify Host entry: wire events, presence, Server酱³, and routes. */
import { Config, resolveConfig, type Config as PluginConfig } from './config.ts'
import { systemClock } from './host/clock.ts'
import { credentialsOf, readSendkey } from './host/credentials.ts'
import { DecisionEngine } from './host/decision.ts'
import { registerEventObservers, type EventContext } from './host/events.ts'
import { PresenceStore } from './host/presence.ts'
import { SettingsService, configEditorOf } from './host/settings.ts'
import { registerRoutes, type RouteWebServer } from './host/routes.ts'
import { ServerChanTransport } from './host/serverchan3.ts'
import { registerNotifyTool } from './host/tool.ts'
import { createSessionState, type SessionAppendLike } from './host/session-state.ts'
import type { LastPush, Logger } from './host/types.ts'

export const name = 'dsh-mobile-notify'
export const inject = ['webServer', 'sessions', 'sessionProjections', 'tools']

export { Config }

export interface HostContext extends EventContext {
  webServer: RouteWebServer
  logger: Logger
  effect: (callback: () => (() => void) | void, label?: string) => void
  fiber?: { entry?: unknown }
}

/** Mount the Host half; invalid config fails the plugin load with an actionable error. */
export function apply(ctx: HostContext, input: PluginConfig): void {
  const config = resolveConfig(input)
  const clock = systemClock
  const health: { lastPush?: LastPush } = {}

  ctx.logger.info(
    `dsh-mobile-notify: transport=${config.transport} tags=${config.serverchan3.tags.enabled ? 'on' : 'off'} detail=${config.notify.detail}`,
  )

  const presence = new PresenceStore(clock)
  const credentials = credentialsOf(ctx)
  const settings = new SettingsService({
    config,
    credentials,
    configEditor: configEditorOf(ctx),
    entry: ctx.fiber?.entry,
    logger: ctx.logger,
  })
  const transport = new ServerChanTransport({
    config,
    logger: ctx.logger,
    clock,
    sendkey: () => readSendkey(credentials),
  })
  const sessionState = createSessionState(ctx, ctx.logger)
  const engine = new DecisionEngine({
    config,
    clock,
    presence,
    transport,
    logger: ctx.logger,
    onPushResult: (event, result) => {
      health.lastPush = {
        at: new Date().toISOString(),
        ok: result.ok,
        kind: event.kind,
      }
    },
    onNoticeEnd: event => {
      const session = ctx.sessions.get(event.sessionId)
      if (session === undefined) return
      sessionState.clearNotice(session as SessionAppendLike, event.callId ?? event.eventId)
    },
  })

  registerEventObservers(ctx, engine, {
    turnDone: session => sessionState.turnDoneFor(session) ?? config.notify.turnDone,
  })

  registerNotifyTool(ctx, {
    config,
    engine,
    sessionState,
    logger: ctx.logger,
    clock,
  })

  ctx.effect(
    () => registerRoutes(
      { webServer: ctx.webServer },
      {
        config,
        presence,
        engine,
        logger: ctx.logger,
        clock,
        version: '0.3.1',
        health,
        settings,
        sendTest: signal => transport.sendTest(signal),
        projectionStatus: () => sessionState.status(),
        setSessionTurnDone: (sessionId, turnDone) => {
          const session = ctx.sessions.get(sessionId)
          if (session === undefined) return false
          sessionState.setTurnDone(session as SessionAppendLike, turnDone)
          return true
        },
      },
    ),
    'dsh-mobile-notify: routes',
  )

  ctx.effect(() => {
    const timer = setInterval(() => presence.prune(), 30_000)
    ;(timer as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.()
    return () => clearInterval(timer)
  }, 'dsh-mobile-notify: presence cleanup')

  ctx.effect(() => () => engine.dispose(), 'dsh-mobile-notify: decision engine')
}
