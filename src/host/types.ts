/** Host-side structural types shared by events, routes, decisions, transport. */
import type { EventKind } from '../shared/tags.ts'

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export type Platform = 'web' | 'android-shell'
export type Visibility = 'visible' | 'hidden'
export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'
export type AckVia = 'in-page' | 'web-notification' | 'none'
export type AckReason =
  | 'none'
  | 'permission-denied'
  | 'unsupported'
  | 'constructor-error'
  | 'hidden-no-notification'

export interface NormalizedEvent {
  readonly eventId: string
  readonly kind: EventKind
  readonly sessionId: string
  readonly callId?: string
  readonly sessionTitle: string
  readonly toolName?: string
  readonly reason?: string
  readonly question?: string
  readonly turn?: number
  readonly createdAt: number
  /** Turn notifications are not resolved by a waterfall; remove after delivery. */
  readonly oneShot?: boolean
}

export interface PresenceInput {
  readonly clientId: string
  readonly platform: Platform
  readonly visibility: Visibility
  readonly focused: boolean
  readonly notification: NotificationPermissionState
  readonly activeSessionId?: string
  readonly at: string
}

export interface AckInput {
  readonly clientId: string
  readonly platform: Platform
  readonly sessionId: string
  readonly kind: EventKind
  readonly key: string
  readonly callId?: string
  readonly delivered: boolean
  readonly via: AckVia
  readonly reason: AckReason
  readonly at: string
}

export interface PushResult {
  readonly ok: boolean
  readonly dryRun: boolean
  readonly status?: number
  readonly error?: string
}

export interface Transport {
  send: (event: NormalizedEvent, signal: AbortSignal) => Promise<PushResult>
}

export interface LastPush {
  at: string
  ok: boolean
  kind: EventKind
}
