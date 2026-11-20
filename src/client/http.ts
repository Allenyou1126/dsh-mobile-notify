/** Small same-origin JSON transport shared by the controller and settings page. */

export async function requestJson(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  ;(timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.()
  try {
    return await fetch(path, {
      ...init,
      credentials: 'same-origin',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export function postJson(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  return requestJson(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs)
}

export function putJson(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  return requestJson(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs)
}
