/** Global bottom banner; rendered only when the shell.bottom slot exists. */
import { useEffect, useSyncExternalStore, type CSSProperties } from 'react'
import type { BannerStore } from './store.ts'
import type { Translate } from './locale.ts'

export interface BannerProps {
  readonly store: BannerStore
  readonly t: Translate
  readonly onShown: (key: string) => void
  readonly onOpen: (sessionId: string) => void
}

const frame: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '6px 12px',
  borderTop: '1px solid var(--dsh-color-border, rgba(127,127,127,.35))',
  background: 'var(--dsh-color-surface, rgba(127,127,127,.12))',
  color: 'var(--dsh-color-text, inherit)',
  fontSize: 12,
  lineHeight: 1.4,
}

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}

const label: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const button: CSSProperties = {
  flex: '0 0 auto',
  border: '1px solid var(--dsh-color-border, rgba(127,127,127,.45))',
  background: 'transparent',
  color: 'inherit',
  borderRadius: 5,
  padding: '2px 8px',
  cursor: 'pointer',
  fontSize: 12,
}

export function Banner({ store, t, onShown, onOpen }: BannerProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  useEffect(() => {
    for (const item of snapshot.items) {
      if (item.needsAck) onShown(item.key)
    }
  }, [snapshot.items, onShown])

  if (snapshot.items.length === 0 && snapshot.notice === undefined) return null

  return (
    <div style={frame} role="status" aria-live="polite">
      {snapshot.items.slice(0, 3).map(item => (
        <div key={item.key} style={row}>
          <span style={label} title={`${item.label} · ${item.kindTitle} · ${item.summary}`}>
            {item.label === '' ? item.kindTitle : `${item.label} · ${item.kindTitle}`}
            {item.summary === '' || item.summary === item.label || item.summary === item.kindTitle
              ? ''
              : ` — ${item.summary}`}
          </span>
          <button type="button" style={button} onClick={() => onOpen(item.sessionId)}>
            {t('banner.open')}
          </button>
        </div>
      ))}
      {snapshot.items.length > 3 ? (
        <div style={row}>
          <span style={label}>{t('banner.more', { count: String(snapshot.items.length - 3) })}</span>
        </div>
      ) : null}
      {snapshot.notice === undefined ? null : (
        <div style={row}>
          <span style={label}>{snapshot.notice}</span>
        </div>
      )}
    </div>
  )
}
