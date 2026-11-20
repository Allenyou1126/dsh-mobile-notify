/** Floating pending-reminder card; registered in the shell.overlay slot. */
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import type { BannerStore } from './store.ts'
import type { Translate } from './locale.ts'

export interface BannerProps {
  readonly store: BannerStore
  readonly t: Translate
  readonly onShown: (key: string) => void
  readonly onOpen: (sessionId: string) => void
}

const card: CSSProperties = {
  position: 'absolute',
  right: 20,
  bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
  zIndex: 40,
  boxSizing: 'border-box',
  width: 'min(380px, calc(100vw - 32px))',
  maxHeight: 'min(70vh, 560px)',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 9,
  padding: '12px 12px 10px',
  border: '1px solid var(--dsw-alias-border-l2, var(--dsh-color-border, rgba(127,127,127,.32)))',
  borderRadius: 14,
  background: 'var(--dsw-alias-bg-layer-1, var(--dsh-color-surface, #fff))',
  color: 'var(--dsw-alias-label-primary, var(--dsh-color-text, inherit))',
  boxShadow: '0 16px 40px rgba(15,23,42,.18), 0 2px 8px rgba(15,23,42,.08)',
  pointerEvents: 'auto',
  fontSize: 12,
  lineHeight: 1.45,
}

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 2px',
}

const title: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  fontSize: 13,
  fontWeight: 650,
  letterSpacing: '.1px',
}

const dot: CSSProperties = {
  flex: '0 0 auto',
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: 'var(--dsw-alias-accent, var(--dsh-color-accent, #4f46e5))',
}

const count: CSSProperties = {
  flex: '0 0 auto',
  fontSize: 10,
  fontWeight: 650,
  lineHeight: '16px',
  minWidth: 18,
  padding: '0 6px',
  borderRadius: 999,
  textAlign: 'center',
  color: 'var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))',
  background: 'var(--dsw-alias-bg-overlay, rgba(127,127,127,.1))',
}

const list: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const itemButton: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 10px',
  border: '1px solid var(--dsw-alias-border-l1, var(--dsh-color-border, rgba(127,127,127,.26)))',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-2, rgba(127,127,127,.055)))',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}

const itemTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
}

const kindChip: CSSProperties = {
  flex: '0 0 auto',
  padding: '0 6px',
  borderRadius: 999,
  border: '1px solid var(--dsw-alias-border-l2, var(--dsh-color-border, rgba(127,127,127,.3)))',
  color: 'var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))',
  fontSize: 10,
  fontWeight: 650,
  lineHeight: '17px',
}

const sessionLabel: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  fontWeight: 600,
}

const summaryText: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))',
  fontSize: 11,
}

const openHint: CSSProperties = {
  marginTop: 1,
  color: 'var(--dsw-alias-accent, var(--dsh-color-accent, #4f46e5))',
  fontSize: 11,
  fontWeight: 600,
}

const moreRow: CSSProperties = {
  padding: '1px 3px 0',
  color: 'var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))',
  fontSize: 11,
}

const noticeRow: CSSProperties = {
  padding: '6px 8px',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,.08))',
  color: 'var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))',
  fontSize: 11,
}

export function Banner({ store, t, onShown, onOpen }: BannerProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [entered, setEntered] = useState(false)
  const items = snapshot.items
  const notice = snapshot.notice
  const visible = items.length > 0 || notice !== undefined

  useEffect(() => {
    for (const item of items) {
      if (item.needsAck) onShown(item.key)
    }
  }, [items, onShown])

  useEffect(() => {
    if (!visible) {
      setEntered(false)
      return
    }
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [visible])

  if (!visible) return null

  const motion: CSSProperties = {
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0) scale(1)' : 'translateY(8px) scale(.985)',
    transformOrigin: 'right bottom',
    transition: 'opacity 160ms ease, transform 180ms cubic-bezier(.2,.8,.2,1)',
  }

  return (
    <div style={{ ...card, ...motion }} role="status" aria-live="polite" aria-label={t('banner.title')}>
      <div style={header}>
        <span style={dot} aria-hidden="true" />
        <span style={title}>{t('banner.title')}</span>
        {items.length > 0 ? <span style={count}>{items.length}</span> : null}
      </div>
      {items.length === 0 ? null : (
        <div style={list}>
          {items.slice(0, 3).map(item => {
            const showSummary = item.summary !== ''
              && item.summary !== item.label
              && item.summary !== item.kindTitle
            return (
              <button
                key={item.key}
                type="button"
                style={itemButton}
                onClick={() => onOpen(item.sessionId)}
                title={`${item.kindTitle}${item.label === '' ? '' : ` · ${item.label}`}${showSummary ? ` — ${item.summary}` : ''}`}
              >
                <span style={itemTop}>
                  <span style={kindChip}>{item.kindTitle}</span>
                  {item.label === '' ? null : <span style={sessionLabel}>{item.label}</span>}
                </span>
                {showSummary ? <span style={summaryText}>{item.summary}</span> : null}
                <span style={openHint}>{t('banner.open')} →</span>
              </button>
            )
          })}
          {items.length > 3 ? (
            <div style={moreRow}>{t('banner.more', { count: String(items.length - 3) })}</div>
          ) : null}
        </div>
      )}
      {notice === undefined ? null : <div style={noticeRow}>{notice}</div>}
    </div>
  )
}
