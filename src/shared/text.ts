/** Text cleaning shared by the Host payload builder and the Client UI. */

/** Remove control characters except normal whitespace, collapse whitespace. */
function normalize(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** Truncate by code points so a surrogate pair is never split. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  return `${chars.slice(0, Math.max(0, max - 1)).join('')}…`
}

/** Clean one optional text value and truncate it to `max` characters. */
export function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = normalize(value)
  if (text === '') return undefined
  return truncate(text, max)
}

/** Clean a required text value; returns an empty string when input is not text. */
export function cleanTextOrEmpty(value: unknown, max: number): string {
  return cleanText(value, max) ?? ''
}

/**
 * Clean one optional multi-line text value: control characters become spaces,
 * runs of spaces/tabs collapse, blank lines are limited to one, and the result
 * is truncated by code points. Line breaks are preserved for Markdown bodies.
 */
export function cleanMultiline(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, ' ')
    .replace(/[ \t]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
  if (text === '') return undefined
  return truncate(text, max)
}

/** Escape characters that could change Markdown structure in a value line. */
export function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#<>|~])/gu, '\\$1')
}

/** Short identity used in logs; never the full session id. */
export function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8)
}
