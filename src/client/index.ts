/** dsh-mobile-notify Client entry: pending watch, in-page banner, Web Notifications,
 * presence/ack reporting, and the `window.__dshMobile` shell bridge. */
import { createElement, type ComponentType } from 'react'
import { Banner } from './Banner.tsx'
import { ConfigCard } from './ConfigCard.tsx'
import { buildAckPayload, type AckPayload } from './ack.ts'
import {
  decideDelivery,
  kindTitle,
  notificationTitle,
  summarizePending,
} from './delivery.ts'
import { dictionaries, NS, type Translate } from './locale.ts'
import { parseClientConfig } from './config.ts'
import { postJson, putJson, requestJson } from './http.ts'
import { TurnTracker } from './turn.ts'
import {
  buildPresencePayload,
  environmentWithShell,
  readEnvironment,
  type PresenceEnvironment,
} from './presence.ts'
import { BannerStore, type BannerItem } from './store.ts'
import { SessionTurnToggle } from './SessionTurnToggle.tsx'
import type {
  ClientConfig,
  ClientContext,
  ClientPlatform,
  DshMobileBridge,
  PendingInteraction,
  PendingItem,
  SessionStatus,
  ShellInfo,
  TestResult,
} from './types.ts'
import { DEFAULT_CLIENT_CONFIG } from './types.ts'
import { cleanText, shortId } from '../shared/text.ts'

export const name = 'dsh-mobile-notify'
export const inject = ['sessions', 'slots', 'locale', 'uiSession', 'uiWorkspace']

const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u
const CLIENT_ID_STORAGE = 'dsh-mobile-notify:clientId'
const HEARTBEAT_MS = 10_000
const SESSION_RETRY_MS = 300
const SESSION_RETRY_LIMIT = 17

type TrackedMode = 'pending' | 'in-page' | 'web-notification' | 'failed'

interface Tracked {
  item: PendingItem
  notified: boolean
  acked: boolean
  mode: TrackedMode
  /** The open Session surface handled an in-page delivery; omit this record from the card. */
  suppressCard?: boolean
  settleTimer?: ReturnType<typeof setTimeout>
  notification?: Notification
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function bindTranslate(ctx: ClientContext): Translate {
  const bound = ctx.locale.bind(NS)
  return (key, params) => bound(key, params)
}

function makeClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // Fall through to the timestamp id.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getClientId(): string {
  try {
    const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE)
    if (existing !== null && existing !== '') return existing
    const id = makeClientId()
    window.sessionStorage.setItem(CLIENT_ID_STORAGE, id)
    return id
  } catch {
    return makeClientId()
  }
}

function detectPlatform(): ClientPlatform {
  if (typeof window === 'undefined') return 'web'
  if (window.__DSH_SHELL__ !== undefined) return 'android-shell'
  try {
    return /DSHAndroidShell\//u.test(navigator.userAgent) ? 'android-shell' : 'web'
  } catch {
    return 'web'
  }
}

function shellInfo(): ShellInfo | undefined {
  return typeof window === 'undefined' ? undefined : window.__DSH_SHELL__
}

function sessionLabel(ctx: ClientContext, sessionId: string): string {
  const label = ctx.sessions.list.getSnapshot().byId[sessionId]?.displayTitle
  return cleanText(label, 40) ?? shortId(sessionId)
}

function normalizeKind(raw: string): PendingItem['kind'] | undefined {
  if (raw === 'approval') return 'approval'
  if (raw === 'question') return 'question'
  if (raw === 'plan-review') return 'plan-review'
  if (raw === 'turn') return 'turn'
  if (raw === 'notice') return 'notice'
  return undefined
}

function normalizePending(
  ctx: ClientContext,
  sessionId: string,
  wait: PendingInteraction,
): PendingItem | undefined {
  const kind = normalizeKind(wait.kind)
  if (kind === undefined) return undefined
  if (typeof wait.key !== 'string' || wait.key === '') return undefined
  const firstQuestion = wait.questions?.[0]?.question
  return {
    key: `${sessionId}:${wait.key}`,
    sessionId,
    kind,
    rawKind: wait.kind,
    waitKey: wait.key,
    label: sessionLabel(ctx, sessionId),
    ...(typeof wait.callId === 'string' && wait.callId !== '' ? { callId: wait.callId } : {}),
    ...(cleanText(wait.toolName, 60) === undefined ? {} : { toolName: cleanText(wait.toolName, 60) }),
    ...(cleanText(wait.reason, 200) === undefined ? {} : { reason: cleanText(wait.reason, 200) }),
    ...(cleanText(firstQuestion, 200) === undefined ? {} : { question: cleanText(firstQuestion, 200) }),
    ...(cleanText(wait.noticeTitle, 80) === undefined ? {} : { noticeTitle: cleanText(wait.noticeTitle, 80) }),
    ...(cleanText(wait.noticeBody, 1000) === undefined ? {} : { noticeBody: cleanText(wait.noticeBody, 1000) }),
    ...(typeof wait.createdAt === 'number' ? { createdAt: wait.createdAt } : {}),
  }
}

/** Mount the Client half. */
export function apply(ctx: ClientContext): void {
  const t = bindTranslate(ctx)
  ctx.effect(() => ctx.locale.register(NS, dictionaries), 'dsh-mobile-notify: locale')

  const clientId = getClientId()
  const platform = detectPlatform()
  const shell = shellInfo()
  const bannerStore = new BannerStore()
  const tracked = new Map<string, Tracked>()
  const turns = new TurnTracker()
  const turnNotifications = new Set<Notification>()
  const retryTimers = new Set<ReturnType<typeof setInterval>>()
  const opening = new Set<string>()
  let config: ClientConfig = DEFAULT_CLIENT_CONFIG
  let active = true
  let bannerAvailable = false
  let shellForeground: boolean | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let presenceInflight = false
  let presenceDirty = false
  let presenceErrorLogged = false
  let unsubscribeStatus: (() => void) | undefined
  let bridgeInstalled = false
  let bridgeObject: DshMobileBridge | undefined
  let previousBridge: DshMobileBridge | undefined
  const publishedNotices = new Map<string, { key: string; dispose: () => void }>()
  const publishNotice = ctx.uiSession.registerPendingInteraction?.(() => 0)

  if (shell?.contract !== undefined && shell.contract > 1) {
    // Forward-compatible: the v1 fields we use are still additive.
    console.debug(`dsh-mobile-notify: shell contract ${shell.contract} > 1; using v1 behavior`)
  }

  function syncNotices(): void {
    if (publishNotice === undefined) return
    try {
      const snapshot = ctx.sessions.list.getSnapshot()
      const seen = new Set<string>()
      for (const sessionId of snapshot.ids) {
        const projected = snapshot.projectionsBySession?.[sessionId]?.values?.['mobileNotify']
        if (typeof projected !== 'object' || projected === null) continue
        const state = projected as { notice?: unknown }
        if (typeof state.notice !== 'object' || state.notice === null) continue
        const notice = state.notice as {
          key?: unknown
          title?: unknown
          body?: unknown
          createdAt?: unknown
        }
        if (typeof notice.key !== 'string' || notice.key === '') continue
        if (typeof notice.title !== 'string' || notice.title === '') continue
        const createdAt = typeof notice.createdAt === 'number' ? notice.createdAt : Date.now()
        seen.add(sessionId)
        const current = publishedNotices.get(sessionId)
        if (current?.key === notice.key) continue
        current?.dispose()
        try {
          const dispose = publishNotice({
            key: notice.key,
            kind: 'notice',
            sessionId,
            callId: notice.key,
            noticeTitle: notice.title,
            ...(typeof notice.body === 'string' && notice.body !== '' ? { noticeBody: notice.body } : {}),
            createdAt,
          }, async () => {})
          publishedNotices.set(sessionId, { key: notice.key, dispose })
        } catch (error) {
          console.debug('dsh-mobile-notify: notice publication failed', error)
        }
      }
      for (const [sessionId, record] of publishedNotices) {
        if (seen.has(sessionId)) continue
        record.dispose()
        publishedNotices.delete(sessionId)
      }
    } catch (error) {
      console.debug('dsh-mobile-notify: notice projection scan failed', error)
    }
  }

  function currentEnvironment(): PresenceEnvironment {
    return environmentWithShell(readEnvironment(), shellForeground)
  }

  function startHeartbeat(): void {
    if (heartbeat !== undefined) return
    heartbeat = setInterval(() => sendPresence(), HEARTBEAT_MS)
    ;(heartbeat as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.()
  }

  function stopHeartbeat(): void {
    if (heartbeat === undefined) return
    clearInterval(heartbeat)
    heartbeat = undefined
  }

  function failPendingInPage(): void {
    for (const record of tracked.values()) {
      if (record.mode === 'in-page' && !record.acked) {
        ack(record, false, 'none', 'hidden-no-notification')
      }
    }
  }

  function syncPresence(): void {
    if (!active) return
    sendPresence()
    if (currentEnvironment().visibility === 'visible') startHeartbeat()
    else {
      stopHeartbeat()
      failPendingInPage()
    }
  }

  function sendPresence(): void {
    if (!active) return
    if (presenceInflight) {
      presenceDirty = true
      return
    }
    presenceInflight = true
    void (async () => {
      try {
        do {
          presenceDirty = false
          const body = buildPresencePayload(clientId, platform, currentEnvironment())
          try {
            const response = await postJson('/mobile/presence', body, 3000)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            presenceErrorLogged = false
          } catch (error) {
            if (!presenceErrorLogged) {
              presenceErrorLogged = true
              console.debug('dsh-mobile-notify: presence post failed', error)
            }
          }
        } while (presenceDirty && active)
      } finally {
        presenceInflight = false
      }
    })()
  }

  function pageHide(): void {
    if (!active) return
    failPendingInPage()
    stopHeartbeat()
    try {
      const body = buildPresencePayload(clientId, platform, {
        visibility: 'hidden',
        focused: false,
        notification: readEnvironment().notification,
      })
      void fetch('/mobile/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => {})
    } catch {
      // pagehide is best effort; Host TTL covers it.
    }
  }

  function onVisibility(): void {
    syncPresence()
    if (currentEnvironment().visibility === 'visible') scan()
  }

  function onFocus(): void {
    sendPresence()
  }

  function onBlur(): void {
    sendPresence()
  }

  function postAck(payload: AckPayload): void {
    void (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await postJson('/mobile/ack', payload, 3000)
          if (response.ok) return
        } catch {
          // Retry once; the Host grace window is the deadline.
        }
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 300))
      }
      console.debug('dsh-mobile-notify: ack post failed')
    })()
  }

  function ack(
    record: Tracked,
    delivered: boolean,
    via: 'in-page' | 'web-notification' | 'none',
    reason: 'none' | 'permission-denied' | 'unsupported' | 'constructor-error' | 'hidden-no-notification',
  ): void {
    if (record.acked) return
    record.acked = true
    const payload = buildAckPayload(record.item, clientId, platform, delivered, via, reason)
    postAck(payload)
    updateBanner()
  }

  function showNotification(record: Tracked): boolean {
    if (typeof Notification === 'undefined') {
      ack(record, false, 'none', 'unsupported')
      return false
    }
    try {
      const notification = new Notification(notificationTitle(record.item, t, config), {
        body: summarizePending(record.item, config, t),
        tag: record.item.key,
      })
      notification.onclick = () => {
        try {
          window.focus()
        } catch {
          // Focus can be blocked; navigation still proceeds.
        }
        void openSession(record.item.sessionId)
        notification.close()
      }
      record.notification = notification
      return true
    } catch {
      ack(record, false, 'none', 'constructor-error')
      return false
    }
  }

  function currentSessionId(): string | undefined {
    try {
      const key = ctx.uiSession.adapter?.current.getSnapshot()?.key
      return typeof key === 'string' && key !== '' ? key : undefined
    } catch {
      return undefined
    }
  }

  function settle(record: Tracked): void {
    record.settleTimer = undefined
    if (!active || tracked.get(record.item.key) !== record) return
    const environment = currentEnvironment()
    const decision = decideDelivery({
      visible: environment.visibility === 'visible',
      focused: environment.focused,
      bannerAvailable,
      notification: environment.notification,
      viewingSession: record.item.kind === 'notice'
        ? false
        : currentSessionId() === record.item.sessionId,
    }, config)
    record.notified = true
    record.mode = decision.mode
    record.suppressCard = decision.suppressCard === true
    if (decision.mode === 'in-page') {
      if (record.suppressCard) {
        // DSH already shows the request in the open Session; ack delivered and
        // keep this record out of the floating card.
        ack(record, true, 'in-page', 'none')
      }
      // Otherwise the card's mount effect sends the in-page ack.
      updateBanner()
      return
    }
    if (decision.mode === 'web-notification') {
      if (showNotification(record)) {
        ack(record, true, 'web-notification', 'none')
      }
      updateBanner()
      return
    }
    ack(record, false, 'none', decision.reason)
    updateBanner()
  }

  function updateBanner(): void {
    if (!config.inPage) {
      bannerStore.setItems([])
      return
    }
    const items: BannerItem[] = []
    for (const record of tracked.values()) {
      if (!record.notified) continue
      if (record.mode === 'in-page' && record.suppressCard === true) continue
      const generic = config.detail === 'generic'
      items.push({
        key: record.item.key,
        sessionId: record.item.sessionId,
        label: generic || !config.includeSessionTitle ? '' : record.item.label,
        kindTitle: generic ? t('banner.generic') : kindTitle(record.item.kind, t),
        summary: generic ? '' : summarizePending(record.item, config, t),
        needsAck: record.mode === 'in-page' && !record.acked,
      })
    }
    bannerStore.setItems(items)
  }

  function onShown(key: string): void {
    const record = tracked.get(key)
    if (record === undefined || record.acked || record.mode !== 'in-page') return
    ack(record, true, 'in-page', 'none')
    bannerStore.markAcked(key)
  }

  function removeTracked(key: string): void {
    const record = tracked.get(key)
    if (record === undefined) return
    if (record.settleTimer !== undefined) {
      clearTimeout(record.settleTimer)
      record.settleTimer = undefined
    }
    record.notification?.close()
    record.notification = undefined
    tracked.delete(key)
  }

  function notifyTurnDone(sessionId: string): void {
    if (!active || !config.turnDone || !config.webNotification) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (ctx.sessions.list.getSnapshot().byId[sessionId]?.origin === 'subagent') return
    const item: PendingItem = {
      key: `${sessionId}:turn`,
      sessionId,
      kind: 'turn',
      rawKind: 'turn',
      waitKey: 'turn',
      label: sessionLabel(ctx, sessionId),
    }
    try {
      const notification = new Notification(notificationTitle(item, t, config), {
        body: summarizePending(item, config, t),
        tag: `dsh-mobile-notify:${sessionId}:turn:${Date.now()}`,
      })
      turnNotifications.add(notification)
      notification.onclose = () => { turnNotifications.delete(notification) }
      notification.onerror = () => {
        turnNotifications.delete(notification)
        console.debug('dsh-mobile-notify: turnDone notification was not shown')
      }
      notification.onclick = () => {
        try {
          window.focus()
        } catch {
          // Focus can be blocked; navigation still proceeds.
        }
        void openSession(sessionId)
        notification.close()
        turnNotifications.delete(notification)
      }
      // Ack only after the browser confirms display. A constructor call alone
      // can succeed while raising `error` (for example on a denied permission).
      let acked = false
      notification.onshow = () => {
        if (acked || !active) return
        acked = true
        const ackPayload = buildAckPayload(item, clientId, platform, true, 'web-notification', 'none')
        postAck(ackPayload)
        // The Host creates its turn record on turn/end. One delayed repeat
        // covers the rare case where the status edge reaches the client first.
        const retry = setTimeout(() => {
          if (active) postAck(ackPayload)
        }, 600)
        ;(retry as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.()
      }
    } catch (error) {
      // No notification means no delivered ack; the Host grace window may fall back.
      console.debug('dsh-mobile-notify: turnDone notification failed', error)
    }
  }

  function scan(): void {
    if (!active) return
    try {
      const status: ReadonlyMap<string, SessionStatus> = ctx.uiSession.sessionStatus.getSnapshot()
      const seen = new Set<string>()
      for (const [sessionId, row] of status) {
        const wait = row.pendingInteraction
        if (wait === undefined) continue
        const item = normalizePending(ctx, sessionId, wait)
        if (item === undefined) continue
        seen.add(item.key)
        if (tracked.has(item.key)) continue
        const record: Tracked = {
          item,
          notified: false,
          acked: false,
          mode: 'pending',
        }
        tracked.set(item.key, record)
        record.settleTimer = setTimeout(() => settle(record), config.settleMs)
      }
      for (const key of [...tracked.keys()]) {
        if (!seen.has(key)) removeTracked(key)
      }
      for (const sessionId of turns.update(status)) notifyTurnDone(sessionId)
      updateBanner()
    } catch (error) {
      console.debug('dsh-mobile-notify: sessionStatus scan failed', error)
    }
  }

  function tryOpen(sessionId: string): boolean {
    try {
      if (ctx.sessions.list.getSnapshot().byId[sessionId] === undefined) return false
      ctx.uiWorkspace.openSession(sessionId)
      return true
    } catch {
      return false
    }
  }

  function openSession(sessionId: string): boolean {
    if (!SESSION_ID_PATTERN.test(sessionId)) return false
    if (tryOpen(sessionId)) return true
    if (opening.has(sessionId)) return true
    opening.add(sessionId)
    let elapsed = 0
    const timer = setInterval(() => {
      if (!active) {
        clearInterval(timer)
        retryTimers.delete(timer)
        opening.delete(sessionId)
        return
      }
      elapsed += SESSION_RETRY_MS
      if (tryOpen(sessionId)) {
        clearInterval(timer)
        retryTimers.delete(timer)
        opening.delete(sessionId)
        return
      }
      if (elapsed >= SESSION_RETRY_MS * SESSION_RETRY_LIMIT) {
        clearInterval(timer)
        retryTimers.delete(timer)
        opening.delete(sessionId)
        bannerStore.showNotice(t('banner.unavailable'))
      }
    }, SESSION_RETRY_MS)
    retryTimers.add(timer)
    ;(timer as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.()
    return true
  }

  function toggleTurnDone(sessionId: string, next: boolean): void {
    void (async () => {
      try {
        const response = await putJson('/mobile/session-settings', { sessionId, turnDone: next }, 5000)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        console.debug('dsh-mobile-notify: per-session turn toggle failed', error)
        bannerStore.showNotice(t('header.turnFailed'))
      }
    })()
  }

  function sendTest(): Promise<TestResult> {
    return (async () => {
      try {
        const response = await requestJson('/mobile/push/test', { method: 'POST' }, 10_000)
        if (response.status !== 202) return 'failed'
        const value: unknown = await response.json().catch(() => undefined)
        return isRecord(value) && value.dryRun === true ? 'dryRun' : 'ok'
      } catch {
        return 'failed'
      }
    })()
  }

  function installBridge(): void {
    if (typeof window === 'undefined') return
    const existing = window.__dshMobile
    const marked = existing as (DshMobileBridge & { __dshMobileNotify?: true }) | undefined
    if (existing !== undefined && marked?.__dshMobileNotify !== true) {
      console.warn('dsh-mobile-notify: window.__dshMobile already exists; leaving it untouched')
      return
    }
    // A marked bridge is a previous generation of this plugin (HMR); replace it
    // instead of restoring the stale object on cleanup.
    previousBridge = marked?.__dshMobileNotify === true ? undefined : existing
    bridgeObject = {
      openSession,
      setForeground: (foreground: boolean) => {
        shellForeground = foreground
        syncPresence()
        if (foreground) scan()
      },
    }
    ;(bridgeObject as DshMobileBridge & { __dshMobileNotify?: true }).__dshMobileNotify = true
    window.__dshMobile = bridgeObject
    bridgeInstalled = true
  }

  function registerSlots(): void {
    const BannerView = (() => createElement(Banner, {
      store: bannerStore,
      t,
      onShown,
      onOpen: (sessionId: string) => { void openSession(sessionId) },
    })) as ComponentType<never>

    ctx.effect(() => {
      let dispose: (() => void) | undefined
      ctx.slots.inject('shell.overlay', () => {
        dispose?.()
        try {
          dispose = ctx.slots.register(
            { name: 'shell.overlay', id: NS, order: 40, locale: NS },
            BannerView,
          )
          bannerAvailable = true
          scan()
        } catch (error) {
          console.warn('dsh-mobile-notify: shell.overlay registration failed', error)
        }
      })
      return () => {
        dispose?.()
        dispose = undefined
        bannerAvailable = false
      }
    }, 'dsh-mobile-notify: banner overlay')

    const TurnToggleView = (props: { sessionId?: string }) => createElement(SessionTurnToggle, {
      sessionId: props.sessionId,
      currentSessionId,
      t,
      getConfig: () => config,
      subscribe: ctx.sessions.list.subscribe,
      getSnapshot: ctx.sessions.list.getSnapshot,
      onToggle: toggleTurnDone,
    })

    ctx.effect(() => {
      let dispose: (() => void) | undefined
      ctx.slots.inject('conversation.session.header.actions', () => {
        dispose?.()
        try {
          dispose = ctx.slots.register(
            { name: 'conversation.session.header.actions', id: 'mobile-notify-turn', order: 60, locale: NS },
            TurnToggleView,
          )
        } catch (error) {
          console.warn('dsh-mobile-notify: turn toggle registration failed', error)
        }
      })
      return () => {
        dispose?.()
        dispose = undefined
      }
    }, 'dsh-mobile-notify: turn toggle')

    const ConfigCardView = (() => createElement(ConfigCard, {
      t,
      sendTest,
    })) as ComponentType<never>

    ctx.effect(() => {
      let dispose: (() => void) | undefined
      ctx.slots.inject('plugins.bundle.config', () => {
        dispose?.()
        try {
          dispose = ctx.slots.register(
            { name: 'plugins.bundle.config', key: NS, locale: NS },
            ConfigCardView,
          )
        } catch (error) {
          console.warn('dsh-mobile-notify: plugin config card registration failed', error)
        }
      })
      return () => {
        dispose?.()
        dispose = undefined
      }
    }, 'dsh-mobile-notify: plugin config card')
  }

  installBridge()
  registerSlots()

  ctx.effect(() => {
    const dispose = ctx.sessions.list.subscribe(() => syncNotices())
    syncNotices()
    return () => {
      dispose()
      for (const record of publishedNotices.values()) record.dispose()
      publishedNotices.clear()
    }
  }, 'dsh-mobile-notify: notice projection')

  unsubscribeStatus = ctx.uiSession.sessionStatus.subscribe(() => scan())
  scan()

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('pagehide', pageHide)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
  }
  syncPresence()

  void (async () => {
    try {
      const response = await requestJson('/mobile/config', { headers: { accept: 'application/json' } }, 3000)
      if (!response.ok) return
      const parsed = parseClientConfig(await response.json())
      if (parsed !== undefined && active) {
        config = parsed
        updateBanner()
      }
    } catch (error) {
      console.debug('dsh-mobile-notify: client config fetch failed; using defaults', error)
    }
  })()

  ctx.effect(() => () => {
    active = false
    stopHeartbeat()
    unsubscribeStatus?.()
    unsubscribeStatus = undefined
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('pagehide', pageHide)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
    for (const timer of retryTimers) clearInterval(timer)
    retryTimers.clear()
    opening.clear()
    for (const record of tracked.values()) {
      if (record.settleTimer !== undefined) clearTimeout(record.settleTimer)
      record.notification?.close()
    }
    tracked.clear()
    turns.clear()
    for (const notification of turnNotifications) {
      try { notification.close() } catch { /* already closed */ }
    }
    turnNotifications.clear()
    bannerStore.dispose()
    if (bridgeInstalled && bridgeObject !== undefined && typeof window !== 'undefined') {
      if (window.__dshMobile === bridgeObject) {
        if (previousBridge === undefined) delete window.__dshMobile
        else window.__dshMobile = previousBridge
      }
    }
    bridgeInstalled = false
    bridgeObject = undefined
  }, 'dsh-mobile-notify: client lifecycle')
}
