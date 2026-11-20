/** Presence payload construction and the browser environment probe. */
import type {
  ClientPlatform,
  NotificationState,
} from './types.ts'

export interface PresencePayload {
  contract: 1
  clientId: string
  platform: ClientPlatform
  visibility: 'visible' | 'hidden'
  focused: boolean
  notification: NotificationState
  at: string
}

export interface PresenceEnvironment {
  readonly visibility: 'visible' | 'hidden'
  readonly focused: boolean
  readonly notification: NotificationState
}

/** Read the permission state without touching the constructor. */
export function notificationState(): NotificationState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** Read the document state defensively; tests pass a fake environment instead. */
export function readEnvironment(): PresenceEnvironment {
  if (typeof document === 'undefined') {
    return { visibility: 'hidden', focused: false, notification: notificationState() }
  }
  const visibility = document.visibilityState === 'visible' ? 'visible' : 'hidden'
  let focused = false
  try {
    focused = document.hasFocus()
  } catch {
    focused = visibility === 'visible'
  }
  return { visibility, focused, notification: notificationState() }
}

/** Apply the Shell's explicit foreground override over document state. */
export function environmentWithShell(
  environment: PresenceEnvironment,
  shellForeground: boolean | undefined,
): PresenceEnvironment {
  if (shellForeground === undefined) return environment
  return {
    visibility: shellForeground ? 'visible' : 'hidden',
    focused: shellForeground,
    notification: environment.notification,
  }
}

export function buildPresencePayload(
  clientId: string,
  platform: ClientPlatform,
  environment: PresenceEnvironment,
  now: Date = new Date(),
): PresencePayload {
  return {
    contract: 1,
    clientId,
    platform,
    visibility: environment.visibility,
    focused: environment.focused,
    notification: environment.notification,
    at: now.toISOString(),
  }
}
