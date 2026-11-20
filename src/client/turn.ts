/** Detect turn completion from Session running-state edges. */
export interface TurnRunningStatus {
  readonly running?: boolean
}

/**
 * Track each Session's last running state and report `true -> false` edges.
 * The first observation only establishes a baseline; a page loaded halfway
 * through a turn still reports the eventual completion.
 */
export class TurnTracker {
  private running = new Map<string, boolean | undefined>()

  /** Apply one status snapshot and return Sessions that just finished a turn. */
  public update(status: ReadonlyMap<string, TurnRunningStatus>): string[] {
    const ended: string[] = []
    const next = new Map<string, boolean | undefined>()
    for (const [sessionId, row] of status) {
      const running = row.running
      if (this.running.get(sessionId) === true && running === false) ended.push(sessionId)
      next.set(sessionId, running)
    }
    this.running = next
    return ended
  }

  /** Forget baselines (used on teardown). */
  public clear(): void {
    this.running.clear()
  }
}
