/** General settings row: browser permission and a generic test push. */
import { useState, type CSSProperties } from 'react'
import type { ClientPlatform, NotificationState } from './types.ts'
import type { Translate } from './locale.ts'

export type TestResult = 'ok' | 'dryRun' | 'failed'

export interface SettingsRowProps {
  readonly t: Translate
  readonly platform: ClientPlatform
  readonly sendTest: () => Promise<TestResult>
}

function currentPermission(): NotificationState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 0',
}

const line: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const title: CSSProperties = {
  fontWeight: 600,
  color: 'var(--dsh-color-text, inherit)',
}

const muted: CSSProperties = {
  color: 'var(--dsh-color-text-secondary, rgba(127,127,127,.95))',
  fontSize: 12,
  lineHeight: 1.5,
}

const button: CSSProperties = {
  border: '1px solid var(--dsh-color-border, rgba(127,127,127,.45))',
  background: 'transparent',
  color: 'var(--dsh-color-text, inherit)',
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 12,
}

function permissionText(t: Translate, state: NotificationState): string {
  switch (state) {
    case 'granted': return t('settings.granted')
    case 'denied': return t('settings.denied')
    case 'default': return t('settings.default')
    case 'unsupported': return t('settings.unsupported')
  }
}

export function SettingsRow({ t, platform, sendTest }: SettingsRowProps) {
  const [permission, setPermission] = useState<NotificationState>(currentPermission)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestResult | undefined>(undefined)

  const request = async (): Promise<void> => {
    if (typeof Notification === 'undefined') return
    try {
      const next = await Notification.requestPermission()
      setPermission(next)
    } catch {
      setPermission(currentPermission())
    }
  }

  const test = async (): Promise<void> => {
    if (testing) return
    setTesting(true)
    setResult(undefined)
    try {
      setResult(await sendTest())
    } catch {
      setResult('failed')
    } finally {
      setTesting(false)
    }
  }

  const platformText = platform === 'android-shell' ? t('settings.platformShell') : t('settings.platformWeb')
  return (
    <div style={wrap}>
      <div style={title}>{t('settings.title')}</div>
      <div style={muted}>{t('settings.description')}</div>
      <div style={line}>
        <span style={muted}>
          {t('settings.permission')}：{permissionText(t, permission)}
        </span>
        {permission === 'granted' || permission === 'unsupported' ? null : (
          <button type="button" style={button} onClick={() => { void request() }}>
            {t('settings.request')}
          </button>
        )}
      </div>
      <div style={line}>
        <span style={muted}>{t('settings.platform')}：{platformText}</span>
        <button type="button" style={button} disabled={testing} onClick={() => { void test() }}>
          {testing ? t('settings.testing') : t('settings.test')}
        </button>
      </div>
      {result === undefined ? null : (
        <div style={muted}>
          {result === 'ok'
            ? t('settings.testOk')
            : result === 'dryRun'
              ? t('settings.testDryRun')
              : t('settings.testFailed')}
        </div>
      )}
    </div>
  )
}
