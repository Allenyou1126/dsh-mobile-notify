/** SendKey storage through the DSH credentials seam, never through config. */
import { isSendkey } from '../shared/serverchan.ts'

export const SENDKEY_RECORD = 'dsh-mobile-notify/serverchan3'

export interface CredentialRecordLike {
  readonly kind?: string
  readonly payload?: unknown
}

export interface CredentialInfoLike {
  readonly configured: boolean
  readonly writable: boolean
  readonly kind?: string
}

export interface CredentialsLike {
  readRecord: (key: string) => Promise<CredentialRecordLike | undefined>
  describeRecord: (key: string) => Promise<CredentialInfoLike>
  modifyRecord: (
    key: string,
    mutate: (current: CredentialRecordLike | undefined) => Promise<CredentialRecordLike | undefined>,
  ) => Promise<CredentialRecordLike | undefined>
  deleteRecord?: (key: string) => Promise<void>
}

export interface SendkeyStatus {
  configured: boolean
  writable: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Pick the credentials service without hard-depending on its package types. */
export function credentialsOf(ctx: { get: (name: string) => unknown }): CredentialsLike | undefined {
  const candidate = ctx.get('credentials')
  if (!isRecord(candidate)) return undefined
  if (
    typeof candidate.readRecord !== 'function'
    || typeof candidate.describeRecord !== 'function'
    || typeof candidate.modifyRecord !== 'function'
  ) return undefined
  return candidate as unknown as CredentialsLike
}

/** Read the stored SendKey; a malformed or unavailable record behaves as absent. */
export async function readSendkey(service: CredentialsLike | undefined): Promise<string | undefined> {
  if (service === undefined) return undefined
  try {
    const record = await service.readRecord(SENDKEY_RECORD)
    if (record?.kind !== 'grant' || !isRecord(record.payload)) return undefined
    const value = record.payload.sendkey
    return isSendkey(value) ? value : undefined
  } catch {
    return undefined
  }
}

/** Presence/writability facts for the settings page; never the value. */
export async function sendkeyStatus(service: CredentialsLike | undefined): Promise<SendkeyStatus> {
  if (service === undefined) return { configured: false, writable: false }
  try {
    const info = await service.describeRecord(SENDKEY_RECORD)
    return { configured: info.configured, writable: info.writable }
  } catch {
    return { configured: false, writable: false }
  }
}

/** Replace or clear the stored SendKey. Validation of the value belongs to the caller. */
export async function writeSendkey(
  service: CredentialsLike | undefined,
  value: string | null,
): Promise<void> {
  if (service === undefined) throw new Error('credentials service unavailable')
  if (value === null) {
    if (service.deleteRecord === undefined) throw new Error('credentials record cannot be cleared')
    await service.deleteRecord(SENDKEY_RECORD)
    return
  }
  await service.modifyRecord(SENDKEY_RECORD, async () => ({
    kind: 'grant',
    payload: { sendkey: value },
  }))
}
