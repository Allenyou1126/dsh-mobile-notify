/** Sliding-window limiter used for inbound routes and outbound pushes. */
import type { Clock } from './clock.ts'

export class RateLimiter {
  private readonly hits = new Map<string, number[]>()
  private readonly clock: Clock

  public constructor(clock: Clock) {
    this.clock = clock
  }

  /**
   * Record one hit for `key` and report whether it is allowed.
   * @param key - client identity or a fixed outbound bucket.
   * @param limit - maximum hits in the window.
   * @param windowMs - sliding window length.
   */
  public take(key: string, limit: number, windowMs: number): boolean {
    const now = this.clock.now()
    const cutoff = now - windowMs
    const recent = (this.hits.get(key) ?? []).filter(at => at > cutoff)
    if (recent.length >= limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    return true
  }

  /** Drop all buckets whose hits are older than `windowMs`. */
  public prune(windowMs: number): void {
    const cutoff = this.clock.now() - windowMs
    for (const [key, hits] of this.hits) {
      const recent = hits.filter(at => at > cutoff)
      if (recent.length === 0) this.hits.delete(key)
      else this.hits.set(key, recent)
    }
  }
}
