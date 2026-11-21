/** Per-conversation turn-done switch in the Session header. */
import { useSyncExternalStore, type CSSProperties } from 'react'
import type { ClientConfig, SessionListSnapshot } from './types.ts'
import type { Translate } from './locale.ts'

export interface SessionTurnToggleProps {
  readonly sessionId?: string
  readonly currentSessionId?: () => string | undefined
  readonly t: Translate
  readonly getConfig: () => ClientConfig
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => SessionListSnapshot
  readonly onToggle: (sessionId: string, next: boolean) => void
}

const button: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  maxWidth: 150,
  boxSizing: 'border-box',
  border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35))',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, rgba(127,127,127,.95))',
  padding: '2px 8px',
  fontSize: 11,
  lineHeight: 1.5,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const enabledStyle: CSSProperties = {
  color: 'var(--dsw-alias-accent, #4f46e5)',
  borderColor: 'color-mix(in srgb, var(--dsw-alias-accent, #4f46e5) 55%, transparent)',
  background: 'color-mix(in srgb, var(--dsw-alias-accent, #4f46e5) 8%, transparent)',
}

function noticeState(snapshot: SessionListSnapshot, sessionId: string): { turnDone?: unknown } | undefined {
  const projected = snapshot.projectionsBySession?.[sessionId]?.values?.['mobileNotify']
  if (typeof projected !== 'object' || projected === null) return undefined
  return projected as { turnDone?: unknown }
}

export function SessionTurnToggle({
  sessionId,
  currentSessionId,
  t,
  getConfig,
  subscribe,
  getSnapshot,
  onToggle,
}: SessionTurnToggleProps) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const target = sessionId === undefined || sessionId === '' ? currentSessionId?.() : sessionId
  if (target === undefined || target === '') return null
  const override = noticeState(snapshot, target)?.turnDone
  const enabled = typeof override === 'boolean' ? override : getConfig().turnDone
  return (
    <button
      type="button"
      style={{ ...button, ...(enabled ? enabledStyle : {}) }}
      aria-pressed={enabled}
      title={enabled ? t('header.turnOn') : t('header.turnOff')}
      onClick={() => onToggle(target, !enabled)}
    >
      <span aria-hidden="true" style={{ opacity: enabled ? 1 : 0.45 }}>🔔</span>
      <span>{t('header.turnLabel')}</span>
    </button>
  )
}
