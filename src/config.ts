/** Plugin configuration: schema for DSH plus a normalized runtime shape. */
import Schema from '@deepseek-ai/schemastery'
import { ConfigError } from './shared/errors.ts'
import {
  resolveTagConfig,
  validateTagConfig,
  type TagConfig,
} from './shared/tags.ts'

export type TransportKind = 'dryRun' | 'serverchan3'
export type DetailLevel = 'summary' | 'title' | 'generic'

export interface NotifyConfig {
  approval: boolean
  question: boolean
  planReview: boolean
  turnDone: boolean
  debounceMs: number
  graceMs: number
  settleMs: number
  detail: DetailLevel
  inPage: boolean
  webNotification: boolean
  inPageCountsAsDelivered: boolean
}

export interface PrivacyConfig {
  includeSessionTitle: boolean
  includeReason: boolean
  includeToolName: boolean
}

export interface LimitsConfig {
  bodyBytes: number
  ratePerMinute: number
  pushPerMinute: number
  pushTimeoutMs: number
  pushRetries: number
}

export interface ServerChan3Input {
  appPackage?: string
  fallbackUrl?: string
  tags?: Partial<TagConfig>
}

/** The Cordis row's input shape (all nested defaults are filled by `resolveConfig`). */
export interface Config {
  publicBase: string
  transport?: TransportKind
  serverchan3?: ServerChan3Input
  notify?: Partial<NotifyConfig>
  privacy?: Partial<PrivacyConfig>
  limits?: Partial<LimitsConfig>
}

export interface EffectiveServerChan3Config {
  appPackage: string
  fallbackUrl: string
  tags: TagConfig
}

export interface EffectiveConfig {
  publicBase: string
  transport: TransportKind
  serverchan3: EffectiveServerChan3Config
  notify: NotifyConfig
  privacy: PrivacyConfig
  limits: LimitsConfig
}

const SCOPE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/u

const tagsSchema = Schema.object({
  enabled: Schema.boolean().default(true),
  namespace: Schema.string().default('dsh'),
  includeNamespace: Schema.boolean().default(true),
  includeKind: Schema.boolean().default(true),
  kindTags: Schema.object({
    approval: Schema.string(),
    question: Schema.string(),
    planReview: Schema.string(),
    turn: Schema.string(),
    test: Schema.string(),
  }).default({}),
  extra: Schema.array(Schema.string()).default([]),
}).default({})

const serverChan3Schema = Schema.object({
  appPackage: Schema.string().default('top.allenyou.dsh'),
  fallbackUrl: Schema.string(),
  tags: tagsSchema,
}).default({})

const notifySchema = Schema.object({
  approval: Schema.boolean().default(true),
  question: Schema.boolean().default(true),
  planReview: Schema.boolean().default(true),
  turnDone: Schema.boolean().default(false),
  debounceMs: Schema.number().default(1500),
  graceMs: Schema.number().default(4000),
  settleMs: Schema.number().default(500),
  detail: Schema.union(['summary', 'title', 'generic']).default('summary'),
  inPage: Schema.boolean().default(true),
  webNotification: Schema.boolean().default(true),
  inPageCountsAsDelivered: Schema.boolean().default(true),
}).default({})

const privacySchema = Schema.object({
  includeSessionTitle: Schema.boolean().default(true),
  includeReason: Schema.boolean().default(true),
  includeToolName: Schema.boolean().default(true),
}).default({})

const limitsSchema = Schema.object({
  bodyBytes: Schema.number().default(2048),
  ratePerMinute: Schema.number().default(120),
  pushPerMinute: Schema.number().default(50),
  pushTimeoutMs: Schema.number().default(8000),
  pushRetries: Schema.number().default(2),
}).default({})

/** Cordis validates this schema before calling `apply`. */
export const Config = Schema.object({
  publicBase: Schema.string().required(),
  transport: Schema.union(['dryRun', 'serverchan3']).default('dryRun'),
  serverchan3: serverChan3Schema,
  notify: notifySchema,
  privacy: privacySchema,
  limits: limitsSchema,
}) as unknown as Schema<Config>

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigError(`${label} is required`)
  }
  return value.trim()
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function boolValue(value: unknown, fallback: boolean, label: string): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new ConfigError(`${label} must be a boolean`)
  return value
}

function intValue(value: unknown, fallback: number, min: number, max: number, label: string): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${label} must be an integer in [${min}, ${max}]`)
  }
  return value
}

function detailValue(value: unknown): DetailLevel {
  if (value === undefined) return 'summary'
  if (value === 'summary' || value === 'title' || value === 'generic') return value
  throw new ConfigError("notify.detail must be 'summary', 'title', or 'generic'")
}

function transportValue(value: unknown): TransportKind {
  if (value === undefined) return 'dryRun'
  if (value === 'dryRun' || value === 'serverchan3') return value
  throw new ConfigError("transport must be 'dryRun' or 'serverchan3'")
}

function normalizeBase(value: unknown, label: string): string {
  const raw = requiredString(value, label)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ConfigError(`${label} must be an absolute http(s) URL`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError(`${label} must use http or https`)
  }
  if (url.username !== '' || url.password !== '') {
    throw new ConfigError(`${label} must not contain credentials`)
  }
  if (url.search !== '' || url.hash !== '') {
    throw new ConfigError(`${label} must not contain a query or fragment`)
  }
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`
  return url.toString()
}

function normalizeServerChan3(
  input: ServerChan3Input | undefined,
  publicBase: string,
): EffectiveServerChan3Config {
  const source = input ?? {}
  const appPackage = optionalString(source.appPackage) ?? 'top.allenyou.dsh'
  if (!SCOPE_KEY_PATTERN.test(appPackage)) {
    throw new ConfigError('serverchan3.appPackage must be a dotted package name')
  }
  const fallbackUrl = normalizeBase(source.fallbackUrl ?? publicBase, 'serverchan3.fallbackUrl')
  const tags = resolveTagConfig(source.tags)
  validateTagConfig(tags)

  return { appPackage, fallbackUrl, tags }
}

/**
 * Validate values that Schemastery cannot express as comfortably (URLs,
 * derived tags, cross-field requirements) and fill all runtime defaults.
 */
export function resolveConfig(input: Config): EffectiveConfig {
  if (typeof input !== 'object' || input === null) {
    throw new ConfigError('plugin config must be an object')
  }
  const publicBase = normalizeBase(input.publicBase, 'publicBase')
  const transport = transportValue(input.transport)
  const notifyInput = input.notify ?? {}
  const privacyInput = input.privacy ?? {}
  const limitsInput = input.limits ?? {}

  const notify: NotifyConfig = {
    approval: boolValue(notifyInput.approval, true, 'notify.approval'),
    question: boolValue(notifyInput.question, true, 'notify.question'),
    planReview: boolValue(notifyInput.planReview, true, 'notify.planReview'),
    turnDone: boolValue(notifyInput.turnDone, false, 'notify.turnDone'),
    debounceMs: intValue(notifyInput.debounceMs, 1500, 0, 10_000, 'notify.debounceMs'),
    graceMs: intValue(notifyInput.graceMs, 4000, 0, 30_000, 'notify.graceMs'),
    settleMs: intValue(notifyInput.settleMs, 500, 0, 2000, 'notify.settleMs'),
    detail: detailValue(notifyInput.detail),
    inPage: boolValue(notifyInput.inPage, true, 'notify.inPage'),
    webNotification: boolValue(notifyInput.webNotification, true, 'notify.webNotification'),
    inPageCountsAsDelivered: boolValue(
      notifyInput.inPageCountsAsDelivered,
      true,
      'notify.inPageCountsAsDelivered',
    ),
  }

  const privacy: PrivacyConfig = {
    includeSessionTitle: boolValue(privacyInput.includeSessionTitle, true, 'privacy.includeSessionTitle'),
    includeReason: boolValue(privacyInput.includeReason, true, 'privacy.includeReason'),
    includeToolName: boolValue(privacyInput.includeToolName, true, 'privacy.includeToolName'),
  }

  const limits: LimitsConfig = {
    bodyBytes: intValue(limitsInput.bodyBytes, 2048, 512, 2048, 'limits.bodyBytes'),
    ratePerMinute: intValue(limitsInput.ratePerMinute, 120, 10, 600, 'limits.ratePerMinute'),
    pushPerMinute: intValue(limitsInput.pushPerMinute, 50, 1, 50, 'limits.pushPerMinute'),
    pushTimeoutMs: intValue(limitsInput.pushTimeoutMs, 8000, 1000, 30_000, 'limits.pushTimeoutMs'),
    pushRetries: intValue(limitsInput.pushRetries, 2, 0, 3, 'limits.pushRetries'),
  }

  return {
    publicBase,
    transport,
    serverchan3: normalizeServerChan3(input.serverchan3, publicBase),
    notify,
    privacy,
    limits,
  }
}

/** Re-export so tests can build a partial tag config without another import. */
export { resolveTagConfig }
