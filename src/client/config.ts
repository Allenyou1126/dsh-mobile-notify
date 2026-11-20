/** Parse the Host's client-facing config; malformed fields fall back to defaults. */
import { DEFAULT_CLIENT_CONFIG, type ClientConfig } from './types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseClientConfig(value: unknown): ClientConfig | undefined {
  if (!isRecord(value) || !isRecord(value.client)) return undefined
  const client = value.client
  const bool = (key: keyof ClientConfig, fallback: boolean): boolean =>
    typeof client[key] === 'boolean' ? client[key] as boolean : fallback
  const detail = client.detail
  const settle = client.settleMs
  return {
    inPage: bool('inPage', DEFAULT_CLIENT_CONFIG.inPage),
    webNotification: bool('webNotification', DEFAULT_CLIENT_CONFIG.webNotification),
    inPageCountsAsDelivered: bool(
      'inPageCountsAsDelivered',
      DEFAULT_CLIENT_CONFIG.inPageCountsAsDelivered,
    ),
    turnDone: bool('turnDone', DEFAULT_CLIENT_CONFIG.turnDone),
    settleMs: typeof settle === 'number' && Number.isFinite(settle) && settle >= 0 && settle <= 2000
      ? Math.round(settle)
      : DEFAULT_CLIENT_CONFIG.settleMs,
    detail: detail === 'summary' || detail === 'title' || detail === 'generic'
      ? detail
      : DEFAULT_CLIENT_CONFIG.detail,
    includeSessionTitle: bool('includeSessionTitle', DEFAULT_CLIENT_CONFIG.includeSessionTitle),
    includeReason: bool('includeReason', DEFAULT_CLIENT_CONFIG.includeReason),
    includeToolName: bool('includeToolName', DEFAULT_CLIENT_CONFIG.includeToolName),
  }
}
