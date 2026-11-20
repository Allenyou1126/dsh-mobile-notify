/** External store for the global bottom banner. */
import type { PendingItem } from './types.ts'

export interface BannerItem {
  readonly key: string
  readonly sessionId: string
  readonly label: string
  readonly kindTitle: string
  readonly summary: string
  readonly needsAck: boolean
}

export interface BannerSnapshot {
  readonly items: readonly BannerItem[]
  readonly notice?: string
}

const EMPTY: BannerSnapshot = { items: [] }

export class BannerStore {
  private snapshot: BannerSnapshot = EMPTY
  private readonly listeners = new Set<() => void>()
  private noticeTimer: ReturnType<typeof setTimeout> | undefined

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  public readonly getSnapshot = (): BannerSnapshot => this.snapshot

  public setItems(items: readonly BannerItem[]): void {
    const previous = this.snapshot
    if (
      previous.items.length === items.length
      && previous.items.every((item, index) => {
        const next = items[index]
        return next !== undefined
          && item.key === next.key
          && item.label === next.label
          && item.kindTitle === next.kindTitle
          && item.summary === next.summary
          && item.needsAck === next.needsAck
      })
      && previous.notice === undefined
    ) return
    this.snapshot = { items: [...items], ...(previous.notice === undefined ? {} : { notice: previous.notice }) }
    this.emit()
  }

  public markAcked(key: string): void {
    let changed = false
    const items = this.snapshot.items.map(item => {
      if (item.key !== key || !item.needsAck) return item
      changed = true
      return { ...item, needsAck: false }
    })
    if (!changed) return
    this.snapshot = { ...this.snapshot, items }
    this.emit()
  }

  public showNotice(text: string): void {
    if (this.noticeTimer !== undefined) clearTimeout(this.noticeTimer)
    this.snapshot = { ...this.snapshot, notice: text }
    this.emit()
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = undefined
      const { notice: _notice, ...rest } = this.snapshot
      this.snapshot = rest
      this.emit()
    }, 4000)
  }

  public dispose(): void {
    if (this.noticeTimer !== undefined) clearTimeout(this.noticeTimer)
    this.noticeTimer = undefined
    this.snapshot = EMPTY
    this.listeners.clear()
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // A subscriber failure must not break the notification controller.
      }
    }
  }
}
