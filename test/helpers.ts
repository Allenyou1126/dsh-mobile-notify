/** Test seams: fake clock, config factory, recording transport, fake logger. */
import { resolveConfig, type Config, type EffectiveConfig, type NotifyConfig } from '../src/config.ts'
import type { Clock, TimerHandle } from '../src/host/clock.ts'
import type { AckInput, Logger, NormalizedEvent, PushResult, Transport } from '../src/host/types.ts'

interface FakeTimer {
  at: number
  callback: () => void
}

export class FakeClock implements Clock {
  private current = 0
  private nextId = 1
  private readonly timers = new Map<number, FakeTimer>()

  public now = (): number => this.current

  public setTimeout = (callback: () => void, ms: number): TimerHandle => {
    const id = this.nextId
    this.nextId += 1
    this.timers.set(id, { at: this.current + Math.max(0, ms), callback })
    return id as unknown as TimerHandle
  }

  public clearTimeout = (handle: TimerHandle): void => {
    this.timers.delete(Number(handle))
  }

  /** Advance by `ms`, firing due timers in time order (including newly scheduled ones). */
  public advance(ms: number): void {
    const target = this.current + ms
    for (;;) {
      let nextId: number | undefined
      let next: FakeTimer | undefined
      for (const [id, timer] of this.timers) {
        if (timer.at > target) continue
        if (next === undefined || timer.at < next.at || (timer.at === next.at && id < nextId!)) {
          next = timer
          nextId = id
        }
      }
      if (next === undefined || nextId === undefined) break
      this.timers.delete(nextId)
      this.current = next.at
      next.callback()
    }
    this.current = target
  }

  public pendingTimers(): number {
    return this.timers.size
  }
}

export function makeConfig(overrides: Partial<NotifyConfig> = {}): EffectiveConfig {
  const input: Config = {
    publicBase: 'https://dsh.example/',
    transport: 'dryRun',
    notify: overrides,
    serverchan3: {
      appPackage: 'top.allenyou.dsh',
      fallbackUrl: 'https://dsh.example/',
    },
  }
  return resolveConfig(input)
}

export function makeEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    eventId: 'event-1',
    kind: 'approval',
    sessionId: 'session-1',
    sessionTitle: 'Refactor database',
    toolName: 'bash',
    reason: 'delete temp files',
    createdAt: 0,
    ...overrides,
  }
}

export class RecordingTransport implements Transport {
  public readonly sent: NormalizedEvent[] = []
  public result: PushResult = { ok: true, dryRun: true }

  public async send(event: NormalizedEvent): Promise<PushResult> {
    this.sent.push(event)
    return this.result
  }
}

export const quietLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export function makeAck(overrides: Partial<AckInput> = {}): AckInput {
  return {
    clientId: 'client-1',
    platform: 'web' as const,
    sessionId: 'session-1',
    kind: 'approval' as const,
    key: 'wait-1',
    delivered: true,
    via: 'in-page' as const,
    reason: 'none' as const,
    at: new Date(0).toISOString(),
    ...overrides,
  }
}
