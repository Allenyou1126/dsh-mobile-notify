/** Graphical settings service: configEditor for non-secrets, credentials for SendKey. */
import type { Config, EffectiveConfig, LimitsConfig, NotifyConfig, PrivacyConfig, TransportKind } from '../config.ts'
import { resolveConfig } from '../config.ts'
import { ConfigError } from '../shared/errors.ts'
import { isSendkey } from '../shared/serverchan.ts'
import type { KindTagKey, TagConfig } from '../shared/tags.ts'
import type { CredentialsLike, SendkeyStatus } from './credentials.ts'
import { sendkeyStatus, writeSendkey } from './credentials.ts'
import type { Logger } from './types.ts'

export interface SettingsConfig {
  publicBase: string
  transport: TransportKind
  serverchan3: {
    appPackage: string
    fallbackUrl: string
    tags: TagConfig
  }
  notify: NotifyConfig
  privacy: PrivacyConfig
  limits: LimitsConfig
}

export interface SettingsView {
  contract: 1
  editable: boolean
  sendkey: SendkeyStatus & { available: boolean }
  settings: SettingsConfig
}

export interface SettingsWriteInput {
  settings: SettingsConfig
  /** A non-empty replacement; null clears the stored key; omitted keeps it. */
  sendkey?: string | null
}

export interface ConfigEditorLike {
  edit: (
    entry: unknown,
    change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
  ) => Promise<void>
}

/** Read the profile config editor service without hard-depending on its package types. */
export function configEditorOf(ctx: { get: (name: string) => unknown }): ConfigEditorLike | undefined {
  const candidate = ctx.get('configEditor')
  if (!isRecord(candidate) || typeof candidate.edit !== 'function') return undefined
  return candidate as unknown as ConfigEditorLike
}

export interface SettingsDeps {
  config: EffectiveConfig
  credentials: CredentialsLike | undefined
  configEditor: ConfigEditorLike | undefined
  entry: unknown
  logger: Logger
}

export class SettingsError extends Error {
  public override readonly name = 'SettingsError'
  public readonly status: 400 | 409 | 502 | 503

  public constructor(status: 400 | 409 | 502 | 503, message: string) {
    super(message)
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function copySettings(config: EffectiveConfig): SettingsConfig {
  return {
    publicBase: config.publicBase,
    transport: config.transport,
    serverchan3: {
      appPackage: config.serverchan3.appPackage,
      fallbackUrl: config.serverchan3.fallbackUrl,
      tags: {
        ...config.serverchan3.tags,
        kindTags: { ...config.serverchan3.tags.kindTags },
        extra: [...config.serverchan3.tags.extra],
      },
    },
    notify: { ...config.notify },
    privacy: { ...config.privacy },
    limits: { ...config.limits },
  }
}

function rawConfig(settings: SettingsConfig): Config {
  return {
    publicBase: settings.publicBase,
    transport: settings.transport,
    serverchan3: {
      appPackage: settings.serverchan3.appPackage,
      fallbackUrl: settings.serverchan3.fallbackUrl,
      tags: {
        enabled: settings.serverchan3.tags.enabled,
        namespace: settings.serverchan3.tags.namespace,
        includeNamespace: settings.serverchan3.tags.includeNamespace,
        includeKind: settings.serverchan3.tags.includeKind,
        kindTags: settings.serverchan3.tags.kindTags as Partial<Record<KindTagKey, string>>,
        extra: settings.serverchan3.tags.extra,
      },
    },
    notify: settings.notify,
    privacy: settings.privacy,
    limits: settings.limits,
  }
}

/** Read/write the plugin's profile config and credential record for the settings page. */
export class SettingsService {
  private readonly deps: SettingsDeps

  public constructor(deps: SettingsDeps) {
    this.deps = deps
  }

  public get editable(): boolean {
    return this.deps.configEditor !== undefined && this.deps.entry !== undefined
  }

  public async read(): Promise<SettingsView> {
    const status = await sendkeyStatus(this.deps.credentials)
    return {
      contract: 1,
      editable: this.editable,
      sendkey: {
        ...status,
        available: this.deps.credentials !== undefined,
      },
      settings: copySettings(this.deps.config),
    }
  }

  /**
   * Persist non-secret config through configEditor and optionally replace/clear
   * the SendKey record. A config change restarts the plugin; the HTTP handler
   * that owns this request may finish after that replacement.
   */
  public async write(input: SettingsWriteInput): Promise<{ ok: true; restarting: boolean }> {
    if (!isRecord(input) || !isRecord(input.settings)) {
      throw new SettingsError(400, 'settings must be an object')
    }
    const settings = input.settings as unknown as SettingsConfig
    if (
      !isRecord(settings)
      || !isRecord(settings.serverchan3)
      || !isRecord(settings.serverchan3.tags)
      || !isRecord(settings.notify)
      || !isRecord(settings.privacy)
      || !isRecord(settings.limits)
    ) {
      throw new SettingsError(400, 'settings is missing required sections')
    }
    try {
      resolveConfig(rawConfig(settings))
    } catch (error) {
      if (error instanceof ConfigError) throw new SettingsError(400, error.message)
      throw error
    }

    const editor = this.deps.configEditor
    const entry = this.deps.entry
    if (editor === undefined || entry === undefined) {
      throw new SettingsError(503, 'this profile does not expose a configuration editor')
    }

    if (input.sendkey !== undefined) {
      const credentials = this.deps.credentials
      if (credentials === undefined) {
        throw new SettingsError(503, 'the credentials service is not available in this profile')
      }
      const status = await sendkeyStatus(credentials)
      if (!status.writable) throw new SettingsError(409, 'the stored SendKey is not writable')
      if (input.sendkey === null) {
        await writeSendkey(credentials, null)
      } else if (typeof input.sendkey === 'string') {
        const value = input.sendkey.trim()
        if (!isSendkey(value)) {
          throw new SettingsError(400, 'SendKey must look like sctp<uid>t<token>')
        }
        await writeSendkey(credentials, value)
      } else {
        throw new SettingsError(400, 'sendkey must be a string or null')
      }
    }

    const next = rawConfig(settings)
    try {
      await editor.edit(entry, (current, _inherited) => {
        const currentServer = isRecord(current.serverchan3) ? current.serverchan3 : {}
        const nextServer = next.serverchan3 ?? {}
        const serverchan3: Record<string, unknown> = { ...currentServer, ...nextServer }
        delete serverchan3.sendkey
        delete serverchan3.uid
        return {
          ...current,
          ...next,
          serverchan3,
        }
      })
    } catch (error) {
      this.deps.logger.warn('dsh-mobile-notify: settings save failed', error)
      throw new SettingsError(502, error instanceof Error ? error.message : 'configuration save failed')
    }
    return { ok: true, restarting: true }
  }
}
