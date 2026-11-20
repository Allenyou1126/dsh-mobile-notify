/** Pure delivery decision and display summary, kept independent of DOM/React. */
import { cleanText } from '../shared/text.ts'
import type {
  AckReason,
  ClientConfig,
  DeliveryMode,
  NotificationState,
  PendingItem,
} from './types.ts'
import type { Translate } from './locale.ts'

export interface DeliveryDecision {
  mode: DeliveryMode
  via: 'in-page' | 'web-notification' | 'none'
  reason: AckReason
  needsInPageAck: boolean
}

export interface DeliveryInput {
  visible: boolean
  focused: boolean
  /** Whether the shell.overlay slot is registered and can actually render. */
  bannerAvailable: boolean
  notification: NotificationState
}

/** Decide how this page can remind the user, before trying to construct a Notification. */
export function decideDelivery(input: DeliveryInput, config: ClientConfig): DeliveryDecision {
  if (
    config.inPage
    && config.inPageCountsAsDelivered
    && input.visible
    && input.focused
    && input.bannerAvailable
  ) {
    return { mode: 'in-page', via: 'in-page', reason: 'none', needsInPageAck: true }
  }
  if (config.webNotification && input.notification === 'granted') {
    return { mode: 'web-notification', via: 'web-notification', reason: 'none', needsInPageAck: false }
  }
  const reason: AckReason = input.notification === 'unsupported'
    ? 'unsupported'
    : input.notification === 'denied' || input.notification === 'default'
      ? 'permission-denied'
      : 'hidden-no-notification'
  return { mode: 'failed', via: 'none', reason, needsInPageAck: false }
}

export function kindTitle(kind: PendingItem['kind'], t: Translate): string {
  switch (kind) {
    case 'approval': return t('banner.approval')
    case 'question': return t('banner.question')
    case 'plan-review': return t('banner.planReview')
    case 'turn': return t('banner.turn')
  }
}

/** One-line content for the banner and the browser notification body. */
export function summarizePending(item: PendingItem, config: ClientConfig, t: Translate): string {
  if (config.detail === 'generic') return t('banner.generic')
  const parts: string[] = []
  if (config.includeSessionTitle && item.label !== '') parts.push(item.label)
  if (config.detail === 'summary') {
    if (config.includeToolName) {
      const tool = cleanText(item.toolName, 60)
      if (tool !== undefined) parts.push(tool)
    }
    if (config.includeReason) {
      const text = cleanText(item.question ?? item.reason, 100)
      if (text !== undefined) parts.push(text)
    }
  }
  if (parts.length === 0) parts.push(kindTitle(item.kind, t))
  return parts.join(' · ')
}

/** Title shown by a browser notification, respecting generic/strict privacy. */
export function notificationTitle(
  item: PendingItem,
  t: Translate,
  config?: ClientConfig,
): string {
  if (config?.detail === 'generic') return t('banner.generic')
  const title = kindTitle(item.kind, t)
  if (config?.includeSessionTitle === false) return title
  return item.label === '' ? title : `${item.label} · ${title}`
}
