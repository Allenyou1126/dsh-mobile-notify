/** Structural Client interfaces: only the DSH surfaces this bundle actually uses. */
import type { ComponentType } from 'react'

export interface Observable<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
}

export interface SessionRow {
  readonly displayTitle?: string
  readonly origin?: string
}

export interface SessionListSnapshot {
  readonly ids: readonly string[]
  readonly byId: Record<string, SessionRow | undefined>
}

export interface PendingInteraction {
  readonly kind: string
  readonly key: string
  readonly sessionId: string
  readonly callId?: string
  readonly toolName?: string
  readonly reason?: string
  readonly questions?: readonly { readonly question?: string }[]
}

export interface SessionStatus {
  readonly pendingInteraction?: PendingInteraction
  readonly completionUnread?: boolean
  readonly running?: boolean
}

export interface SlotOptions {
  readonly name: string
  readonly id?: string
  readonly key?: string
  readonly order?: number
  readonly locale?: string
}

export interface ClientSlots {
  inject: (name: string, callback: () => void) => void
  register: (options: SlotOptions, component: ComponentType<never>) => () => void
}

export interface ClientLocale {
  register: (namespace: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }) => () => void
  bind: (namespace: string) => (key: string, params?: Record<string, string>) => string
}

export interface SessionBindingSnapshot {
  readonly key?: string
}

export interface ClientUiSession {
  readonly sessionStatus: Observable<ReadonlyMap<string, SessionStatus>>
  /** Main-view Session binding; `current.key` is the Session the user is viewing. */
  readonly adapter?: {
    readonly current: Observable<SessionBindingSnapshot>
  }
}

export interface ClientWorkspace {
  openSession: (sessionId: string) => void
}

export interface ClientSessions {
  readonly list: Observable<SessionListSnapshot>
}

export interface ClientContext {
  slots: ClientSlots
  locale: ClientLocale
  sessions: ClientSessions
  uiSession: ClientUiSession
  uiWorkspace: ClientWorkspace
  effect: (callback: () => (() => void) | void, label?: string) => void
}

export type TestResult = 'ok' | 'dryRun' | 'failed'

export type ClientPlatform = 'web' | 'android-shell'
export type DetailLevel = 'summary' | 'title' | 'generic'
export type NotificationState = 'granted' | 'denied' | 'default' | 'unsupported'
export type DeliveryMode = 'in-page' | 'web-notification' | 'failed'
export type AckVia = 'in-page' | 'web-notification' | 'none'
export type AckReason =
  | 'none'
  | 'permission-denied'
  | 'unsupported'
  | 'constructor-error'
  | 'hidden-no-notification'

export interface ClientConfig {
  inPage: boolean
  webNotification: boolean
  inPageCountsAsDelivered: boolean
  turnDone: boolean
  settleMs: number
  detail: DetailLevel
  includeSessionTitle: boolean
  includeReason: boolean
  includeToolName: boolean
}

export const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  inPage: true,
  webNotification: true,
  inPageCountsAsDelivered: true,
  turnDone: false,
  settleMs: 500,
  detail: 'summary',
  includeSessionTitle: true,
  includeReason: true,
  includeToolName: true,
}

export type PendingKind = 'approval' | 'question' | 'plan-review' | 'turn'

export interface PendingItem {
  readonly key: string
  readonly sessionId: string
  readonly kind: PendingKind
  readonly rawKind: string
  readonly waitKey: string
  readonly callId?: string
  readonly label: string
  readonly toolName?: string
  readonly reason?: string
  readonly question?: string
}

export interface ShellInfo {
  readonly version?: string
  readonly contract?: number
}

export interface DshMobileBridge {
  openSession: (sessionId: string) => boolean
  setForeground: (foreground: boolean) => void
}

declare global {
  interface Window {
    __dshMobile?: DshMobileBridge
    __DSH_SHELL__?: ShellInfo
  }
}
