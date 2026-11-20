/** Server酱³ SendKey parsing shared by configuration, credentials, and transport. */

/** Official SendKey shape: `sctp<uid>t<token>`, URL-safe. */
export const SENDKEY_PATTERN = /^sctp\d+t[A-Za-z0-9_-]+$/u

/** Type guard for a SendKey stored through the settings UI or credentials record. */
export function isSendkey(value: unknown): value is string {
  return typeof value === 'string' && SENDKEY_PATTERN.test(value)
}

/** Extract the numeric uid embedded in a SendKey. */
export function uidFromSendkey(value: string): string | undefined {
  return /^sctp(\d+)t/u.exec(value)?.[1]
}
