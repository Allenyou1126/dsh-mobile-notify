import assert from 'node:assert/strict'
import test from 'node:test'
import { ConfigError } from '../src/shared/errors.ts'
import {
  buildTags,
  kindTag,
  resolveTagConfig,
  tagString,
  validateTagConfig,
} from '../src/shared/tags.ts'

test('default tags follow namespace + kind order', () => {
  const config = resolveTagConfig()
  assert.deepEqual(buildTags('approval', config).tags, ['dsh', 'dsh-approval'])
  assert.deepEqual(buildTags('question', config).tags, ['dsh', 'dsh-question'])
  assert.deepEqual(buildTags('plan-review', config).tags, ['dsh', 'dsh-plan-review'])
  assert.deepEqual(buildTags('turn', config).tags, ['dsh', 'dsh-turn'])
  assert.deepEqual(buildTags('test', config).tags, ['dsh', 'dsh-test'])
  assert.deepEqual(buildTags('notice', config).tags, ['dsh', 'dsh-notice'])
  assert.equal(tagString('approval', config), 'dsh|dsh-approval')
})

test('namespace, kind override, and extra tags are applied in order and deduplicated', () => {
  const config = resolveTagConfig({
    namespace: 'dsh-home',
    extra: ['homelab', 'dsh-home', 'homelab'],
    kindTags: { approval: 'priority' },
  })
  validateTagConfig(config)
  assert.deepEqual(buildTags('approval', config).tags, ['dsh-home', 'priority', 'homelab'])
  assert.equal(kindTag('question', config), 'dsh-home-question')
})

test('includeNamespace and includeKind can remove their tags', () => {
  const config = resolveTagConfig({ includeNamespace: false, includeKind: false, extra: ['work'] })
  validateTagConfig(config)
  assert.deepEqual(buildTags('approval', config).tags, ['work'])
  // test keeps its tag even when event kind tags are disabled.
  assert.deepEqual(buildTags('test', config).tags, ['dsh-test', 'work'])
})

test('enabled=false omits all tags', () => {
  const config = resolveTagConfig({ enabled: false, extra: ['work'] })
  validateTagConfig(config)
  assert.deepEqual(buildTags('approval', config).tags, [])
  assert.equal(tagString('test', config), undefined)
})

test('invalid tags and derived-overlong tags fail configuration', () => {
  assert.throws(() => validateTagConfig(resolveTagConfig({ namespace: 'bad tag' })), ConfigError)
  assert.throws(() => validateTagConfig(resolveTagConfig({ extra: Array.from({ length: 7 }, (_, i) => `tag-${i}`) })), ConfigError)
  assert.throws(() => validateTagConfig(resolveTagConfig({ kindTags: { approval: 'bad|tag' } })), ConfigError)
  const longNamespace = 'a'.repeat(32)
  assert.throws(() => validateTagConfig(resolveTagConfig({ namespace: longNamespace })), ConfigError)
})

test('buildTags drops unexpected runtime-invalid tags without throwing', () => {
  const config = resolveTagConfig()
  const result = buildTags('approval', { ...config, extra: ['bad tag', 'ok', 'ok'] })
  assert.deepEqual(result.tags, ['dsh', 'dsh-approval', 'ok'])
  assert.deepEqual(result.dropped, ['bad tag'])
})
