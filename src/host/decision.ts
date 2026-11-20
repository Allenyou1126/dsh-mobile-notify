/**
 * Web-first fallback state machine.
 *
 * The engine is deliberately transport-agnostic: it decides whether a pending
 * event should reach the phone, then hands one normalized event to a
 * `Transport`. Timers are injected so tests never sleep.
 */
import type { EffectiveConfig } from '../config.ts'
import { shortId } from '../shared/text.ts'
import type { Clock, TimerHandle } from './clock.ts'
import { PresenceStore } from './presence.ts'
import type {
  AckInput,
  Logger,
  NormalizedEvent,
  PushResult,
  Transport,
} from './types.ts'

type RecordState = 'debouncing' | 'waiting-ack' | 'pushing' | 'pushed' | 'suppressed' | 'resolved'

interface PendingRecord {
  readonly event: NormalizedEvent
  readonly baseKey: string
  state: RecordState
  readonly acks: Map<string, AckInput>
  readonly expectedClientIds: Set<string>
  debounceTimer?: TimerHandle
  graceTimer?: TimerHandle
  pushAbort?: AbortController
  pushResult?: PushResult
}

export interface DecisionDeps {
  readonly config: EffectiveConfig
  readonly clock: Clock
  readonly presence: PresenceStore
  readonly transport: Transport
  readonly logger: Logger
  readonly onPushResult?: (event: NormalizedEvent, result: PushResult) => void
}

/** Stable correlation key for one pending event. */
export function baseKeyFor(event: NormalizedEvent): string {
  return `${event.sessionId}:${event.kind}${event.callId === undefined ? '' : `:${event.callId}`}`
}

function keyForAck(ack: AckInput): string {
  return `${ack.sessionId}:${ack.kind}${ack.callId === undefined ? '' : `:${ack.callId}`}`
}

function isEnabled(config: EffectiveConfig, kind: NormalizedEvent['kind']): boolean {
  switch (kind) {
    case 'approval': return config.notify.approval
    case 'question': return config.notify.question
    case 'plan-review': return config.notify.planReview
    case 'turn': return config.notify.turnDone
    case 'test': return false
  }
}

export class DecisionEngine {
  private readonly records = new Map<string, PendingRecord>()
  private readonly deps: DecisionDeps
  private readonly unsubscribe: () => void

  public constructor(deps: DecisionDeps) {
    this.deps = deps
    this.unsubscribe = deps.presence.subscribe(() => this.onPresenceChanged())
  }

  /** Number of live records (approved/resolved records are removed). */
  public get pendingCount(): number {
    return this.records.size
  }

  /**
   * Start debounce for one waterfall event. Returns false when the event is
   * disabled or is a duplicate of an active record.
   */
  public begin(event: NormalizedEvent): boolean {
    if (!isEnabled(this.deps.config, event.kind)) return false
    const baseKey = baseKeyFor(event)
    if (this.records.has(baseKey)) {
      this.deps.logger.debug(`dsh-mobile-notify: duplicate event ${baseKey}`)
      return false
    }
    const record: PendingRecord = {
      event,
      baseKey,
      state: 'debouncing',
      acks: new Map(),
      expectedClientIds: new Set(),
    }
    this.records.set(baseKey, record)
    record.debounceTimer = this.deps.clock.setTimeout(
      () => this.evaluate(record),
      this.deps.config.notify.debounceMs,
    )
    return true
  }

  /** Called when the waterfall returns: clear pending and cancel any unsent push. */
  public resolve(event: NormalizedEvent): void {
    this.delete(baseKeyFor(event))
  }

  /** Apply a client delivery acknowledgement. */
  public onAck(ack: AckInput): void {
    const record = this.findRecord(ack)
    if (record === undefined) {
      this.deps.logger.debug(`dsh-mobile-notify: ack for unknown ${shortId(ack.sessionId)}:${ack.kind}`)
      return
    }
    record.acks.set(ack.clientId, ack)
    if (ack.delivered) {
      this.suppress(record)
      return
    }
    if (record.state === 'waiting-ack' && this.allExpectedAckedFalse(record)) {
      this.push(record)
    }
  }

  /** Release all timers and listeners. */
  public dispose(): void {
    for (const record of [...this.records.values()]) this.delete(record.baseKey)
    this.unsubscribe()
  }

  private findRecord(ack: AckInput): PendingRecord | undefined {
    const exact = this.records.get(keyForAck(ack))
    if (exact !== undefined) return exact
    // Host/Client callId availability can differ (older client, omitted field).
    // Falling back to the unique session+kind record is safe; ambiguity is not.
    const candidates = [...this.records.values()].filter(
      record => record.event.sessionId === ack.sessionId && record.event.kind === ack.kind,
    )
    if (candidates.length > 1) {
      this.deps.logger.warn(`dsh-mobile-notify: ambiguous ack for ${shortId(ack.sessionId)}:${ack.kind}`)
      return undefined
    }
    return candidates[0]
  }

  private evaluate(record: PendingRecord): void {
    if (this.records.get(record.baseKey) !== record || record.state !== 'debouncing') return
    record.debounceTimer = undefined
    const config = this.deps.config

    if (
      config.notify.inPage
      && config.notify.inPageCountsAsDelivered
      && this.deps.presence.phoneForeground()
    ) {
      this.suppress(record)
      return
    }

    const webClients = this.deps.presence.liveWebClientIds()
    if (webClients.length === 0) {
      this.push(record)
      return
    }

    record.state = 'waiting-ack'
    for (const clientId of webClients) record.expectedClientIds.add(clientId)

    if (this.anyAckDelivered(record)) {
      this.suppress(record)
      return
    }
    if (this.allExpectedAckedFalse(record)) {
      this.push(record)
      return
    }

    record.graceTimer = this.deps.clock.setTimeout(
      () => this.onGraceTimeout(record),
      config.notify.graceMs,
    )
  }

  private onGraceTimeout(record: PendingRecord): void {
    if (this.records.get(record.baseKey) !== record || record.state !== 'waiting-ack') return
    record.graceTimer = undefined
    if (
      this.deps.config.notify.inPage
      && this.deps.config.notify.inPageCountsAsDelivered
      && this.deps.presence.phoneForeground()
    ) {
      this.suppress(record)
      return
    }
    if (this.anyAckDelivered(record)) {
      this.suppress(record)
      return
    }
    this.push(record)
  }

  private onPresenceChanged(): void {
    for (const record of this.records.values()) {
      if (
        record.state === 'waiting-ack'
        && this.deps.config.notify.inPage
        && this.deps.config.notify.inPageCountsAsDelivered
        && this.deps.presence.phoneForeground()
      ) {
        this.suppress(record)
      }
    }
  }

  private anyAckDelivered(record: PendingRecord): boolean {
    for (const ack of record.acks.values()) {
      if (ack.delivered) return true
    }
    return false
  }

  private allExpectedAckedFalse(record: PendingRecord): boolean {
    if (record.expectedClientIds.size === 0) return false
    for (const clientId of record.expectedClientIds) {
      const ack = record.acks.get(clientId)
      if (ack === undefined || ack.delivered) return false
    }
    return true
  }

  private suppress(record: PendingRecord): void {
    if (this.records.get(record.baseKey) !== record) return
    this.clearTimers(record)
    record.state = 'suppressed'
    record.pushAbort?.abort()
    record.pushAbort = undefined
    this.deps.logger.debug(`dsh-mobile-notify: suppressed ${shortId(record.event.sessionId)}:${record.event.kind}`)
    if (record.event.oneShot) this.delete(record.baseKey)
  }

  private push(record: PendingRecord): void {
    if (this.records.get(record.baseKey) !== record) return
    if (record.state === 'pushing' || record.state === 'pushed') return
    this.clearTimers(record)
    record.state = 'pushing'
    const controller = new AbortController()
    record.pushAbort = controller
    this.deps.logger.info(
      `dsh-mobile-notify: pushing ${record.event.kind} ${shortId(record.event.sessionId)}`,
    )

    Promise.resolve()
      .then(() => this.deps.transport.send(record.event, controller.signal))
      .then(result => {
        if (this.records.get(record.baseKey) !== record) return
        record.pushResult = result
        record.pushAbort = undefined
        record.state = 'pushed'
        try {
          this.deps.onPushResult?.(record.event, result)
        } catch (error) {
          this.deps.logger.warn('dsh-mobile-notify: push result callback failed', error)
        }
        if (!result.ok) {
          this.deps.logger.warn(
            `dsh-mobile-notify: push failed for ${shortId(record.event.sessionId)}: ${result.error ?? 'unknown'}`,
          )
        }
        if (record.event.oneShot) this.delete(record.baseKey)
      })
      .catch((error: unknown) => {
        if (this.records.get(record.baseKey) !== record) return
        record.pushAbort = undefined
        record.state = 'pushed'
        record.pushResult = { ok: false, dryRun: false, error: 'exception' }
        this.deps.logger.warn('dsh-mobile-notify: push threw', error)
        if (record.event.oneShot) this.delete(record.baseKey)
      })
  }

  private clearTimers(record: PendingRecord): void {
    if (record.debounceTimer !== undefined) {
      this.deps.clock.clearTimeout(record.debounceTimer)
      record.debounceTimer = undefined
    }
    if (record.graceTimer !== undefined) {
      this.deps.clock.clearTimeout(record.graceTimer)
      record.graceTimer = undefined
    }
  }

  private delete(baseKey: string): void {
    const record = this.records.get(baseKey)
    if (record === undefined) return
    this.clearTimers(record)
    record.pushAbort?.abort()
    record.pushAbort = undefined
    record.state = 'resolved'
    this.records.delete(baseKey)
  }
}
