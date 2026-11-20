/** Runtime copy for the banner and the settings row. */
export const NS = 'dsh-mobile-notify'

const zh = {
  'banner.approval': '需要审批',
  'banner.question': '需要回答',
  'banner.planReview': '需要确认计划',
  'banner.turn': '本轮完成',
  'banner.generic': 'DSH 有待处理提醒',
  'banner.open': '打开会话',
  'banner.more': '还有 {count} 项',
  'banner.unavailable': '会话暂不可用，请在 DSH 会话列表中打开',
  'settings.title': '移动通知',
  'settings.description': '页内提示 / 浏览器通知优先；未提醒到且手机不在前台时由 Server酱³ 推送。',
  'settings.permission': '浏览器通知权限',
  'settings.granted': '已允许',
  'settings.denied': '已拒绝，可在浏览器站点设置中恢复',
  'settings.default': '尚未授权',
  'settings.unsupported': '当前环境不支持浏览器通知',
  'settings.request': '请求通知权限',
  'settings.test': '发送测试推送',
  'settings.testing': '发送中…',
  'settings.testOk': '测试推送已发送',
  'settings.testDryRun': 'dryRun：已记录，未真正发送',
  'settings.testFailed': '测试推送失败，请查看 DSH 日志',
  'settings.platform': '平台',
  'settings.platformWeb': '浏览器',
  'settings.platformShell': 'Android Shell',
} as const

const en: Record<keyof typeof zh, string> = {
  'banner.approval': 'Needs approval',
  'banner.question': 'Needs an answer',
  'banner.planReview': 'Needs plan review',
  'banner.turn': 'Turn finished',
  'banner.generic': 'DSH has a pending reminder',
  'banner.open': 'Open session',
  'banner.more': '{count} more',
  'banner.unavailable': 'Session is not available yet; open it from the DSH session list',
  'settings.title': 'Mobile notifications',
  'settings.description': 'In-page and browser notifications first; Server酱³ only when Web did not deliver and the phone is not in the foreground.',
  'settings.permission': 'Browser notification permission',
  'settings.granted': 'Granted',
  'settings.denied': 'Denied — restore it in the browser site settings',
  'settings.default': 'Not requested yet',
  'settings.unsupported': 'Browser notifications are not supported here',
  'settings.request': 'Request permission',
  'settings.test': 'Send test push',
  'settings.testing': 'Sending…',
  'settings.testOk': 'Test push sent',
  'settings.testDryRun': 'dryRun: recorded, not sent',
  'settings.testFailed': 'Test push failed; check the DSH log',
  'settings.platform': 'Platform',
  'settings.platformWeb': 'Browser',
  'settings.platformShell': 'Android Shell',
}

export type LocaleKey = keyof typeof zh
export type Translate = (key: LocaleKey, params?: Record<string, string>) => string

export const dictionaries = { zh, en }

/** Small lookup used when a slot does not provide its own locale binding. */
export function translate(language: 'zh' | 'en', key: LocaleKey, params?: Record<string, string>): string {
  let text: string = dictionaries[language][key]
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, value)
  }
  return text
}
