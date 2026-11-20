/** Configuration card shown on Plugins → dsh-mobile-notify → Configuration. */
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import type { SettingsConfig, SettingsView } from '../host/settings.ts'
import type { KindTagKey } from '../shared/tags.ts'
import { putJson, requestJson } from './http.ts'
import type { Translate } from './locale.ts'
import type { TestResult } from './types.ts'

export interface ConfigCardProps {
  readonly t: Translate
  readonly sendTest: () => Promise<TestResult>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'uncertain' | 'failed'

const section: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '14px 0',
  borderTop: '1px solid var(--dsh-color-border, rgba(127,127,127,.28))',
}
const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 650 }
const muted: CSSProperties = { fontSize: 12, lineHeight: 1.5, color: 'var(--dsh-color-text-secondary, rgba(127,127,127,.95))' }
const row: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) minmax(0, 1fr)', gap: 10, alignItems: 'center' }
const rowLabel: CSSProperties = { fontSize: 12, color: 'var(--dsh-color-text-secondary, rgba(127,127,127,.95))' }
const input: CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  border: '1px solid var(--dsh-color-border, rgba(127,127,127,.4))',
  borderRadius: 6,
  background: 'transparent',
  color: 'inherit',
  padding: '5px 8px',
  fontSize: 12,
}
const button: CSSProperties = {
  border: '1px solid var(--dsh-color-border, rgba(127,127,127,.45))',
  borderRadius: 6,
  background: 'transparent',
  color: 'inherit',
  padding: '5px 10px',
  fontSize: 12,
  cursor: 'pointer',
}
const primary: CSSProperties = { ...button, background: 'var(--dsh-color-accent, #4f46e5)', color: '#fff', borderColor: 'transparent' }
const checks: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }
const check: CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }
const actions: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }
const badge: CSSProperties = {
  alignSelf: 'flex-start',
  flexShrink: 0,
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid var(--dsh-color-border, rgba(127,127,127,.4))',
  fontSize: 11,
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorText(value: unknown): string {
  if (isRecord(value) && typeof value.message === 'string') return value.message
  if (isRecord(value) && typeof value.error === 'string') return value.error
  return ''
}

const kindKeys: readonly KindTagKey[] = ['approval', 'question', 'planReview', 'turn', 'test']

export function ConfigCard({ t, sendTest }: ConfigCardProps) {
  const [view, setView] = useState<SettingsView | undefined>(undefined)
  const [draft, setDraft] = useState<SettingsConfig | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [sendkey, setSendkey] = useState('')
  const [clearSendkey, setClearSendkey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | undefined>(undefined)
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

  const load = async (): Promise<void> => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await requestJson('/mobile/settings', { headers: { accept: 'application/json' } }, 5000)
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => undefined)
        throw new Error(errorText(body) || `HTTP ${response.status}`)
      }
      const body = await response.json() as SettingsView
      const next = JSON.parse(JSON.stringify(body.settings)) as SettingsConfig
      setView(body)
      setDraft(next)
      setSendkey('')
      setClearSendkey(false)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t('config.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    void (async () => {
      if (!mounted) return
      await load()
    })()
    return () => { mounted = false }
  }, [])

  const mutate = (change: (current: SettingsConfig) => SettingsConfig): void => {
    setDraft(current => current === undefined ? current : change(current))
  }
  const server = (patch: Partial<SettingsConfig['serverchan3']>): void => mutate(current => ({
    ...current,
    serverchan3: { ...current.serverchan3, ...patch },
  }))
  const tags = (patch: Partial<SettingsConfig['serverchan3']['tags']>): void => mutate(current => ({
    ...current,
    serverchan3: {
      ...current.serverchan3,
      tags: { ...current.serverchan3.tags, ...patch },
    },
  }))
  const notify = (patch: Partial<SettingsConfig['notify']>): void => mutate(current => ({ ...current, notify: { ...current.notify, ...patch } }))
  const privacy = (patch: Partial<SettingsConfig['privacy']>): void => mutate(current => ({ ...current, privacy: { ...current.privacy, ...patch } }))
  const limits = (patch: Partial<SettingsConfig['limits']>): void => mutate(current => ({ ...current, limits: { ...current.limits, ...patch } }))

  const setKindTag = (key: KindTagKey, value: string): void => {
    mutate(current => {
      const kindTags = { ...current.serverchan3.tags.kindTags }
      if (value.trim() === '') delete kindTags[key]
      else kindTags[key] = value.trim()
      return {
        ...current,
        serverchan3: {
          ...current.serverchan3,
          tags: { ...current.serverchan3.tags, kindTags },
        },
      }
    })
  }

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (draft === undefined || view?.editable === false || saveState === 'saving') return
    // Saving is a user gesture: use it to request the browser permission that
    // turnDone needs before claiming Web Notification delivery.
    if (
      draft.notify.turnDone
      && typeof Notification !== 'undefined'
      && Notification.permission === 'default'
    ) {
      try { setPermission(await Notification.requestPermission()) } catch { /* keep default */ }
    }
    setSaveState('saving')
    setSaveMessage('')
    const body: { settings: SettingsConfig; sendkey?: string | null } = { settings: draft }
    if (clearSendkey) body.sendkey = null
    else if (sendkey.trim() !== '') body.sendkey = sendkey.trim()
    try {
      const response = await putJson('/mobile/settings', body, 30_000)
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(errorText(payload) || t('config.saveFailed'))
      setSaveState('saved')
      setSaveMessage(t('config.saved'))
      setSendkey('')
      setClearSendkey(false)
      setTimeout(() => { void load() }, 900)
    } catch (error) {
      // The config change restarts the plugin, so a dropped request is expected.
      setSaveState('uncertain')
      setSaveMessage(error instanceof Error && error.message !== '' ? `${t('config.saveUncertain')} (${error.message})` : t('config.saveUncertain'))
      setTimeout(() => { void load() }, 1500)
    }
  }

  const test = async (): Promise<void> => {
    if (testing) return
    setTesting(true)
    setTestResult(undefined)
    try { setTestResult(await sendTest()) } catch { setTestResult('failed') } finally { setTesting(false) }
  }

  const requestPermission = async (): Promise<void> => {
    if (typeof Notification === 'undefined') return
    try { setPermission(await Notification.requestPermission()) } catch { setPermission(permission) }
  }

  if (loading && draft === undefined) {
    return <div style={section}><span style={muted}>{t('config.loading')}</span></div>
  }
  if (draft === undefined) {
    return (
      <div style={section}>
        <span style={muted}>{t('config.loadFailed')}</span>
        {loadError === '' ? null : <span style={muted}>{loadError}</span>}
        <div><button type="button" style={button} onClick={() => { void load() }}>{t('config.reload')}</button></div>
      </div>
    )
  }

  const editable = view?.editable !== false
  const sendkeyStatus = view?.sendkey
  const note = sendkeyStatus === undefined
    ? t('config.sendkeyMissing')
    : sendkeyStatus.configured
      ? t('config.sendkeyConfigured')
      : t('config.sendkeyMissing')

  return (
    <form style={{ display: 'flex', flexDirection: 'column' }} onSubmit={(event) => { void save(event) }}>
      <div style={section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t('config.title')}</div>
            <div style={muted}>{t('config.description')}</div>
          </div>
          <span style={badge}>{view?.sendkey.available === false ? t('config.credentialsUnavailable') : t('config.pluginConfig')}</span>
        </div>
        {editable ? null : <div style={{ ...muted, color: 'var(--dsh-color-warning, #b45309)' }}>{t('config.readOnly')}</div>}
      </div>

      <div style={section}>
        <div style={sectionTitle}>{t('config.deployment')}</div>
        <label style={row}><span style={rowLabel}>{t('config.publicBase')}</span>
          <input style={input} type="url" value={draft.publicBase} disabled={!editable} onChange={e => mutate(c => ({ ...c, publicBase: e.target.value }))} />
        </label>
        <label style={row}><span style={rowLabel}>{t('config.transport')}</span>
          <select style={input} value={draft.transport} disabled={!editable} onChange={e => mutate(c => ({ ...c, transport: e.target.value as SettingsConfig['transport'] }))}>
            <option value="dryRun">{t('config.transportDryRun')}</option>
            <option value="serverchan3">{t('config.transportServerchan3')}</option>
          </select>
        </label>
        <label style={row}><span style={rowLabel}>{t('config.appPackage')}</span>
          <input style={input} value={draft.serverchan3.appPackage} disabled={!editable} onChange={e => server({ appPackage: e.target.value })} />
        </label>
        <label style={row}><span style={rowLabel}>{t('config.fallbackUrl')}</span>
          <input style={input} type="url" value={draft.serverchan3.fallbackUrl} disabled={!editable} onChange={e => server({ fallbackUrl: e.target.value })} />
        </label>
      </div>

      <div style={section}>
        <div style={sectionTitle}>{t('config.serverchan3')}</div>
        <div style={row}>
          <span style={rowLabel}>{t('config.sendkey')}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input style={{ ...input, flex: '1 1 260px' }} type="password" autoComplete="new-password" placeholder={t('config.sendkeyHint')} value={sendkey} disabled={!editable || clearSendkey} onChange={e => setSendkey(e.target.value)} />
              <span style={badge}>{note}</span>
            </div>
            <div style={checks}>
              <label style={check}><input type="checkbox" checked={clearSendkey} disabled={!editable} onChange={e => setClearSendkey(e.target.checked)} />{t('config.clearSendkey')}</label>
              {sendkeyStatus?.available === false ? <span style={muted}>{t('config.credentialsUnavailable')}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>{t('config.tags')}</div>
        <div style={checks}>
          <label style={check}><input type="checkbox" checked={draft.serverchan3.tags.enabled} disabled={!editable} onChange={e => tags({ enabled: e.target.checked })} />{t('config.tagsEnabled')}</label>
          <label style={check}><input type="checkbox" checked={draft.serverchan3.tags.includeNamespace} disabled={!editable} onChange={e => tags({ includeNamespace: e.target.checked })} />{t('config.includeNamespace')}</label>
          <label style={check}><input type="checkbox" checked={draft.serverchan3.tags.includeKind} disabled={!editable} onChange={e => tags({ includeKind: e.target.checked })} />{t('config.includeKind')}</label>
        </div>
        <label style={row}><span style={rowLabel}>{t('config.namespace')}</span>
          <input style={input} value={draft.serverchan3.tags.namespace} disabled={!editable} onChange={e => tags({ namespace: e.target.value })} />
        </label>
        <label style={row}><span style={rowLabel}>{t('config.extraTags')}</span>
          <input style={input} value={draft.serverchan3.tags.extra.join(', ')} disabled={!editable} onChange={e => tags({ extra: e.target.value.split(/[,\n]/u).map(v => v.trim()).filter(v => v !== '') })} placeholder="homelab, work" />
        </label>
        <details>
          <summary style={{ ...muted, cursor: 'pointer' }}>{t('config.kindTags')}</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {kindKeys.map(key => (
              <label key={key} style={row}>
                <span style={rowLabel}>{key}</span>
                <input style={input} value={draft.serverchan3.tags.kindTags[key] ?? ''} placeholder={key === 'planReview' ? 'dsh-plan-review' : `dsh-${key}`} disabled={!editable} onChange={e => setKindTag(key, e.target.value)} />
              </label>
            ))}
          </div>
        </details>
      </div>

      <div style={section}>
        <div style={sectionTitle}>{t('config.notify')}</div>
        <div style={checks}>
          <label style={check}><input type="checkbox" checked={draft.notify.approval} disabled={!editable} onChange={e => notify({ approval: e.target.checked })} />{t('config.approval')}</label>
          <label style={check}><input type="checkbox" checked={draft.notify.question} disabled={!editable} onChange={e => notify({ question: e.target.checked })} />{t('config.question')}</label>
          <label style={check}><input type="checkbox" checked={draft.notify.planReview} disabled={!editable} onChange={e => notify({ planReview: e.target.checked })} />{t('config.planReview')}</label>
          <label style={check}><input type="checkbox" checked={draft.notify.turnDone} disabled={!editable} onChange={e => notify({ turnDone: e.target.checked })} />{t('config.turnDone')}</label>
          <label style={check}><input type="checkbox" checked={draft.notify.inPage} disabled={!editable} onChange={e => notify({ inPage: e.target.checked })} />{t('config.inPage')}</label>
          <label style={check}><input type="checkbox" checked={draft.notify.webNotification} disabled={!editable} onChange={e => notify({ webNotification: e.target.checked })} />{t('config.webNotification')}</label>
          <label style={check}><input type="checkbox" checked={draft.notify.inPageCountsAsDelivered} disabled={!editable} onChange={e => notify({ inPageCountsAsDelivered: e.target.checked })} />{t('config.inPageCounts')}</label>
        </div>
        {draft.notify.turnDone && permission !== 'granted' ? (
          <div style={muted}>{t('config.turnDonePermissionHint')}</div>
        ) : null}
        <label style={row}><span style={rowLabel}>{t('config.detail')}</span>
          <select style={input} value={draft.notify.detail} disabled={!editable} onChange={e => notify({ detail: e.target.value as SettingsConfig['notify']['detail'] })}>
            <option value="summary">{t('config.detailSummary')}</option>
            <option value="title">{t('config.detailTitle')}</option>
            <option value="generic">{t('config.detailGeneric')}</option>
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <label style={check}><span style={rowLabel}>{t('config.debounce')}</span><input style={input} type="number" min={0} max={10000} value={draft.notify.debounceMs} disabled={!editable} onChange={e => notify({ debounceMs: Number(e.target.value) })} /></label>
          <label style={check}><span style={rowLabel}>{t('config.grace')}</span><input style={input} type="number" min={0} max={30000} value={draft.notify.graceMs} disabled={!editable} onChange={e => notify({ graceMs: Number(e.target.value) })} /></label>
          <label style={check}><span style={rowLabel}>{t('config.settle')}</span><input style={input} type="number" min={0} max={2000} value={draft.notify.settleMs} disabled={!editable} onChange={e => notify({ settleMs: Number(e.target.value) })} /></label>
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>{t('config.privacy')}</div>
        <div style={checks}>
          <label style={check}><input type="checkbox" checked={draft.privacy.includeSessionTitle} disabled={!editable} onChange={e => privacy({ includeSessionTitle: e.target.checked })} />{t('config.includeSession')}</label>
          <label style={check}><input type="checkbox" checked={draft.privacy.includeReason} disabled={!editable} onChange={e => privacy({ includeReason: e.target.checked })} />{t('config.includeReason')}</label>
          <label style={check}><input type="checkbox" checked={draft.privacy.includeToolName} disabled={!editable} onChange={e => privacy({ includeToolName: e.target.checked })} />{t('config.includeTool')}</label>
        </div>
      </div>

      <div style={section}>
        <details>
          <summary style={{ ...muted, cursor: 'pointer' }}>{t('config.limits')}</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 8 }}>
            <label style={row}><span style={rowLabel}>{t('config.bodyBytes')}</span><input style={input} type="number" min={512} max={2048} value={draft.limits.bodyBytes} disabled={!editable} onChange={e => limits({ bodyBytes: Number(e.target.value) })} /></label>
            <label style={row}><span style={rowLabel}>{t('config.ratePerMinute')}</span><input style={input} type="number" min={10} max={600} value={draft.limits.ratePerMinute} disabled={!editable} onChange={e => limits({ ratePerMinute: Number(e.target.value) })} /></label>
            <label style={row}><span style={rowLabel}>{t('config.pushPerMinute')}</span><input style={input} type="number" min={1} max={50} value={draft.limits.pushPerMinute} disabled={!editable} onChange={e => limits({ pushPerMinute: Number(e.target.value) })} /></label>
            <label style={row}><span style={rowLabel}>{t('config.pushTimeout')}</span><input style={input} type="number" min={1000} max={30000} value={draft.limits.pushTimeoutMs} disabled={!editable} onChange={e => limits({ pushTimeoutMs: Number(e.target.value) })} /></label>
            <label style={row}><span style={rowLabel}>{t('config.pushRetries')}</span><input style={input} type="number" min={0} max={3} value={draft.limits.pushRetries} disabled={!editable} onChange={e => limits({ pushRetries: Number(e.target.value) })} /></label>
          </div>
        </details>
      </div>

      <div style={section}>
        <div style={sectionTitle}>{t('config.permission')}</div>
        <div style={actions}>
          <span style={muted}>{permission}</span>
          {permission === 'granted' || permission === 'unsupported' ? null : <button type="button" style={button} onClick={() => { void requestPermission() }}>{t('config.requestPermission')}</button>}
        </div>
      </div>

      <div style={{ ...section, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={actions}>
          <button type="submit" style={{ ...primary, opacity: editable && saveState !== 'saving' ? 1 : .55 }} disabled={!editable || saveState === 'saving'}>
            {saveState === 'saving' ? t('config.saving') : t('config.save')}
          </button>
          <button type="button" style={button} disabled={!editable} onClick={() => { void load() }}>{t('config.reload')}</button>
          <button type="button" style={button} disabled={testing} onClick={() => { void test() }}>{testing ? t('config.testing') : t('config.test')}</button>
        </div>
        <div style={muted}>
          {saveMessage !== '' ? saveMessage : testResult === undefined ? '' : testResult === 'ok' ? t('config.testOk') : testResult === 'dryRun' ? t('config.testDryRun') : t('config.testFailed')}
        </div>
      </div>
    </form>
  )
}

