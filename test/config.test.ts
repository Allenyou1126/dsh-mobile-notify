import assert from 'node:assert/strict'
import test from 'node:test'
import { Config, resolveConfig } from '../src/config.ts'
import { isSendkey } from '../src/shared/serverchan.ts'
import { ConfigError } from '../src/shared/errors.ts'

test('minimal config fills defaults and normalizes the base URL', () => {
  const config = resolveConfig({ publicBase: 'https://dsh.example' })
  assert.equal(config.publicBase, 'https://dsh.example/')
  assert.equal(config.transport, 'dryRun')
  assert.equal(config.serverchan3.appPackage, 'top.allenyou.dsh')
  assert.equal(config.serverchan3.fallbackUrl, 'https://dsh.example/')
  assert.equal(config.notify.debounceMs, 1500)
  assert.equal(config.notify.graceMs, 4000)
  assert.equal(config.notify.inPage, true)
  assert.deepEqual(config.serverchan3.tags.extra, [])
})

test('serverchan3 config leaves credentials to the credentials service', () => {
  const config = resolveConfig({
    publicBase: 'https://dsh.example/',
    transport: 'serverchan3',
    serverchan3: { appPackage: 'top.allenyou.dsh' },
  })
  assert.equal(config.transport, 'serverchan3')
  assert.equal(config.serverchan3.appPackage, 'top.allenyou.dsh')
  assert.equal('sendkey' in config.serverchan3, false)
})

test('SendKey syntax is validated separately from config', () => {
  assert.equal(isSendkey('sctp42tTOKEN'), true)
  assert.equal(isSendkey('SCT42TOKEN'), false)
  assert.equal(isSendkey('sctp42tTOKEN with space'), false)
})

test('URL and limit validation fails loudly', () => {
  assert.throws(() => resolveConfig({ publicBase: 'ftp://dsh.example/' }), ConfigError)
  assert.throws(() => resolveConfig({ publicBase: 'https://dsh.example/?x=1' }), ConfigError)
  assert.throws(
    () => resolveConfig({ publicBase: 'https://dsh.example/', limits: { bodyBytes: 4096 } }),
    ConfigError,
  )
  assert.throws(
    () => resolveConfig({ publicBase: 'https://dsh.example/', notify: { debounceMs: -1 } }),
    ConfigError,
  )
})

test('tag configuration is validated during resolve', () => {
  assert.throws(
    () => resolveConfig({
      publicBase: 'https://dsh.example/',
      serverchan3: { tags: { namespace: 'bad tag' } },
    }),
    ConfigError,
  )
})

test('the exported Schemastery schema fills runtime defaults', () => {
  const parsed = Config({ publicBase: 'https://dsh.example/' }) as unknown as {
    transport: string
    notify: { debounceMs: number; inPage: boolean }
    serverchan3: { appPackage: string; tags: { namespace: string; extra: string[] } }
  }
  assert.equal(parsed.transport, 'dryRun')
  assert.equal(parsed.notify.debounceMs, 1500)
  assert.equal(parsed.notify.inPage, true)
  assert.equal(parsed.serverchan3.appPackage, 'top.allenyou.dsh')
  assert.equal(parsed.serverchan3.tags.namespace, 'dsh')
  assert.deepEqual(parsed.serverchan3.tags.extra, [])
})
