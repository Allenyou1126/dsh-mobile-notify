/** Ack payload construction; the actual POST lives in the controller. */
import type {
  AckReason,
  AckVia,
  ClientPlatform,
  PendingItem,
} from './types.ts'

export interface AckPayload {
  contract: 1
  clientId: string
  platform: ClientPlatform
  sessionId: string
  kind: PendingItem['kind']
  key: string
  callId?: string
  delivered: boolean
  via: AckVia
  reason: AckReason
  at: string
}

export function buildAckPayload(
  item: PendingItem,
  clientId: string,
  platform: ClientPlatform,
  delivered: boolean,
  via: AckVia,
  reason: AckReason,
  now: Date = new Date(),
): AckPayload {
  return {
    contract: 1,
    clientId,
    platform,
    sessionId: item.sessionId,
    kind: item.kind,
    key: item.waitKey,
    delivered,
    via,
    reason,
    at: now.toISOString(),
    ...(item.callId === undefined ? {} : { callId: item.callId }),
  }
}
