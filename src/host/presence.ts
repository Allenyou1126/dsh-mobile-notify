/** Presence registry with platform-specific TTLs. */
import type { Clock } from './clock.ts'
import type { PresenceInput } from './types.ts'

export const WEB_TTL_MS = 120_000
export const SHELL_TTL_MS = 15_000

export interface PresenceRecord extends PresenceInput {
  readonly receivedAt: number
}

export interface PresenceCounts {
  web: number
  androidShell: number
}

export class PresenceStore {
  private readonly records = new Map<string, PresenceRecord>()
  private readonly listeners = new Set<() => void>()
  private readonly clock: Clock

  public constructor(clock: Clock) {
    this.clock = clock
  }

  /** Insert or replace one client's presence; TTL starts at server receipt time. */
  public update(input: PresenceInput): void {
    this.records.set(input.clientId, { ...input, receivedAt: this.clock.now() })
    this.emit()
  }

  /** Remove expired records and notify listeners when anything changed. */
  public prune(): void {
    const now = this.clock.now()
    let changed = false
    for (const [clientId, record] of this.records) {
      if (now - record.receivedAt > this.ttlFor(record.platform)) {
        this.records.delete(clientId)
        changed = true
      }
    }
    if (changed) this.emit()
  }

  /** True while an Android shell reports itself visible and focused. */
  public phoneForeground(): boolean {
    const now = this.clock.now()
    for (const record of this.records.values()) {
      if (
        record.platform === 'android-shell'
        && record.visibility === 'visible'
        && record.focused
        && this.fresh(record, now)
      ) return true
    }
    return false
  }

  /** Fresh web clients, regardless of visibility, used to decide whether to wait for an ack. */
  public liveWebClientIds(): string[] {
    const now = this.clock.now()
    const ids: string[] = []
    for (const record of this.records.values()) {
      if (record.platform === 'web' && this.fresh(record, now)) ids.push(record.clientId)
    }
    return ids
  }

  /** Counts for the health route; expires first. */
  public counts(): PresenceCounts {
    this.prune()
    const now = this.clock.now()
    let web = 0
    let androidShell = 0
    for (const record of this.records.values()) {
      if (!this.fresh(record, now)) continue
      if (record.platform === 'web') web += 1
      else androidShell += 1
    }
    return { web, androidShell }
  }

  /** Subscribe to updates/prunes; returns an idempotent unsubscribe. */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  public clear(): void {
    if (this.records.size === 0) return
    this.records.clear()
    this.emit()
  }

  private ttlFor(platform: PresenceInput['platform']): number {
    return platform === 'android-shell' ? SHELL_TTL_MS : WEB_TTL_MS
  }

  private fresh(record: PresenceRecord, now: number): boolean {
    return now - record.receivedAt <= this.ttlFor(record.platform)
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // Presence listeners must never break request handling.
      }
    }
  }
}
