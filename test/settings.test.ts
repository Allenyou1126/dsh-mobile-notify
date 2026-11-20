import assert from 'node:assert/strict'
import test from 'node:test'
import type { CredentialInfoLike, CredentialRecordLike, CredentialsLike } from '../src/host/credentials.ts'
import { readSendkey, writeSendkey } from '../src/host/credentials.ts'
import { SettingsError, SettingsService } from '../src/host/settings.ts'
import { makeConfig, quietLogger } from './helpers.ts'

class FakeCredentials implements CredentialsLike {
  public record: CredentialRecordLike | undefined
  public writable = true

  public async readRecord(): Promise<CredentialRecordLike | undefined> {
    return this.record
  }

  public async describeRecord(): Promise<CredentialInfoLike> {
    return { configured: this.record !== undefined, writable: this.writable }
  }

  public async modifyRecord(
    _key: string,
    mutate: (current: CredentialRecordLike | undefined) => Promise<CredentialRecordLike | undefined>,
  ): Promise<CredentialRecordLike | undefined> {
    this.record = await mutate(this.record)
    return this.record
  }

  public async deleteRecord(): Promise<void> {
    this.record = undefined
  }
}

class FakeEditor {
  public entry: unknown
  public next: Record<string, unknown> | undefined

  public async edit(
    entry: unknown,
    change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<void> {
    this.entry = entry
    this.next = change({
      publicBase: 'https://old.example/',
      serverchan3: { sendkey: 'legacy-secret', uid: '1', appPackage: 'old.package' },
      custom: 'keep',
    }, { inherited: true })
  }
}

function makeService(options: { editor?: boolean; credentials?: boolean } = {}) {
  const credentials = new FakeCredentials()
  const editor = new FakeEditor()
  const service = new SettingsService({
    config: makeConfig(),
    credentials: options.credentials === false ? undefined : credentials,
    configEditor: options.editor === false ? undefined : editor,
    entry: options.editor === false ? undefined : {},
    logger: quietLogger,
  })
  return { service, credentials, editor }
}

test('settings read exposes config and masked SendKey status', async () => {
  const { service, credentials } = makeService()
  const view = await service.read()
  assert.equal(view.editable, true)
  assert.equal(view.sendkey.configured, false)
  assert.equal(view.sendkey.available, true)
  assert.equal(view.settings.transport, 'dryRun')
  assert.equal(view.settings.serverchan3.tags.namespace, 'dsh')

  credentials.record = { kind: 'grant', payload: { sendkey: 'sctp42tTOKEN' } }
  const configured = await service.read()
  assert.equal(configured.sendkey.configured, true)
  assert.equal(JSON.stringify(configured).includes('sctp42tTOKEN'), false)
})

test('settings write persists SendKey in credentials and strips it from config', async () => {
  const { service, credentials, editor } = makeService()
  const view = await service.read()
  const result = await service.write({ settings: view.settings, sendkey: 'sctp42tTOKEN' })
  assert.deepEqual(result, { ok: true, restarting: true })
  assert.deepEqual(credentials.record, { kind: 'grant', payload: { sendkey: 'sctp42tTOKEN' } })
  assert.ok(editor.next !== undefined)
  const server = editor.next.serverchan3 as Record<string, unknown>
  assert.equal(server.sendkey, undefined)
  assert.equal(server.uid, undefined)
  assert.equal(server.appPackage, 'top.allenyou.dsh')
  assert.equal(editor.next.custom, 'keep')
})

test('settings write can clear the stored SendKey', async () => {
  const { service, credentials } = makeService()
  credentials.record = { kind: 'grant', payload: { sendkey: 'sctp42tTOKEN' } }
  const view = await service.read()
  await service.write({ settings: view.settings, sendkey: null })
  assert.equal(credentials.record, undefined)
})

test('invalid SendKey and invalid settings are rejected before config writes', async () => {
  const { service, editor } = makeService()
  const view = await service.read()
  await assert.rejects(
    service.write({ settings: view.settings, sendkey: 'not-a-key' }),
    (error: unknown) => error instanceof SettingsError && error.status === 400,
  )
  assert.equal(editor.next, undefined)
  const bad = JSON.parse(JSON.stringify(view.settings)) as typeof view.settings
  bad.publicBase = 'ftp://dsh.example/'
  await assert.rejects(
    service.write({ settings: bad }),
    (error: unknown) => error instanceof SettingsError && error.status === 400,
  )
})

test('missing config editor is read-only and write is refused', async () => {
  const { service } = makeService({ editor: false })
  const view = await service.read()
  assert.equal(view.editable, false)
  await assert.rejects(
    service.write({ settings: view.settings }),
    (error: unknown) => error instanceof SettingsError && error.status === 503,
  )
})

test('SendKey helper reads and clears records', async () => {
  const credentials = new FakeCredentials()
  credentials.record = { kind: 'grant', payload: { sendkey: 'sctp42tTOKEN' } }
  assert.equal(await readSendkey(credentials), 'sctp42tTOKEN')
  credentials.record = { kind: 'grant', payload: { sendkey: 'bad' } }
  assert.equal(await readSendkey(credentials), undefined)
  await writeSendkey(credentials, null)
  assert.equal(credentials.record, undefined)
})
