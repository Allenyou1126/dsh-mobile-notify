/** Server酱³ tag grouping: low-cardinality, static, and testable. */
import { ConfigError } from './errors.ts'

/** Message classes this plugin can push (test is the test route; notice is the model tool). */
export type EventKind = 'approval' | 'question' | 'plan-review' | 'turn' | 'test' | 'notice'

/** Config keys for kind tags. `test` is not an event but is overridable too. */
export type KindTagKey = 'approval' | 'question' | 'planReview' | 'turn' | 'test' | 'notice'

export interface TagConfig {
  enabled: boolean
  namespace: string
  includeNamespace: boolean
  includeKind: boolean
  kindTags: Partial<Record<KindTagKey, string>>
  extra: string[]
}

export interface TagBuildResult {
  tags: string[]
  dropped: string[]
}

export const DEFAULT_NAMESPACE = 'dsh'
export const MAX_TAGS = 8
export const MAX_EXTRA_TAGS = 6
export const MAX_TAG_LENGTH = 32

/** Unicode letters/numbers plus dot/underscore/hyphen; no whitespace or `|`. */
export const TAG_PATTERN = /^[\p{L}\p{N}._-]{1,32}$/u

const KIND_KEYS: readonly KindTagKey[] = ['approval', 'question', 'planReview', 'turn', 'test', 'notice']

/** Map a message kind to its config key. */
export function kindTagKey(kind: EventKind): KindTagKey {
  if (kind === 'plan-review') return 'planReview'
  return kind
}

/** Slug used by the default `namespace-kind` tag. */
export function kindSlug(kind: EventKind): string {
  return kind
}

/** Fill missing tag config with the documented defaults. */
export function resolveTagConfig(input?: Partial<TagConfig> | null): TagConfig {
  const kindTags: Partial<Record<KindTagKey, string>> = {}
  for (const key of KIND_KEYS) {
    const value = input?.kindTags?.[key]
    if (typeof value === 'string') kindTags[key] = value.trim()
  }
  return {
    enabled: input?.enabled ?? true,
    namespace: (input?.namespace ?? DEFAULT_NAMESPACE).trim(),
    includeNamespace: input?.includeNamespace ?? true,
    includeKind: input?.includeKind ?? true,
    kindTags,
    extra: Array.isArray(input?.extra) ? input.extra.map(value => value.trim()) : [],
  }
}

function assertTag(value: string, label: string): void {
  if (!TAG_PATTERN.test(value)) {
    throw new ConfigError(
      `${label} must be 1-${MAX_TAG_LENGTH} letters/numbers/._- characters (no whitespace or '|')`,
    )
  }
}

/** The default or overridden tag for one kind. */
export function kindTag(kind: EventKind, config: TagConfig): string {
  const key = kindTagKey(kind)
  const override = config.kindTags[key]
  if (override !== undefined && override !== '') return override
  return `${config.namespace}-${kindSlug(kind)}`
}

/** Validate every configured tag and the derived tags for enabled message kinds. */
export function validateTagConfig(config: TagConfig): void {
  assertTag(config.namespace, 'serverchan3.tags.namespace')
  for (const key of KIND_KEYS) {
    const value = config.kindTags[key]
    if (value !== undefined) assertTag(value, `serverchan3.tags.kindTags.${key}`)
  }
  if (config.extra.length > MAX_EXTRA_TAGS) {
    throw new ConfigError(`serverchan3.tags.extra may contain at most ${MAX_EXTRA_TAGS} tags`)
  }
  for (const [index, value] of config.extra.entries()) {
    assertTag(value, `serverchan3.tags.extra[${index}]`)
  }
  if (!config.enabled) return
  const kinds: readonly EventKind[] = ['approval', 'question', 'plan-review', 'turn', 'notice']
  for (const kind of kinds) {
    if (config.includeKind) assertTag(kindTag(kind, config), `serverchan3.tags for ${kind}`)
  }
  assertTag(kindTag('test', config), 'serverchan3.tags for test')
}

/**
 * Build the ordered tag list for one message.
 *
 * Order is namespace → kind/test → extra. Test always gets its tag even when
 * `includeKind` is false, because a test message is not an event.
 */
export function buildTags(kind: EventKind, config: TagConfig): TagBuildResult {
  if (!config.enabled) return { tags: [], dropped: [] }

  const candidates: string[] = []
  if (config.includeNamespace) candidates.push(config.namespace)
  if (kind === 'test' || config.includeKind) candidates.push(kindTag(kind, config))
  candidates.push(...config.extra)

  const tags: string[] = []
  const dropped: string[] = []
  for (const candidate of candidates) {
    if (!TAG_PATTERN.test(candidate)) {
      dropped.push(candidate)
      continue
    }
    if (tags.includes(candidate)) continue
    if (tags.length >= MAX_TAGS) {
      dropped.push(candidate)
      continue
    }
    tags.push(candidate)
  }
  return { tags, dropped }
}

/** Join tags for the Server酱³ `tags` field; undefined when there are none. */
export function tagString(kind: EventKind, config: TagConfig): string | undefined {
  const { tags } = buildTags(kind, config)
  return tags.length === 0 ? undefined : tags.join('|')
}
