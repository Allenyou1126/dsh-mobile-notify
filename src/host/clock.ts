/** Small clock seam so decision tests never sleep. */

export type TimerHandle = ReturnType<typeof setTimeout>

export interface Clock {
  now: () => number
  setTimeout: (callback: () => void, ms: number) => TimerHandle
  clearTimeout: (handle: TimerHandle) => void
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => {
    const handle = setTimeout(callback, ms)
    ;(handle as TimerHandle & { unref?: () => void }).unref?.()
    return handle
  },
  clearTimeout: handle => clearTimeout(handle),
}

/** Await a delay without keeping the process alive. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    const handle = setTimeout(resolve, ms)
    ;(handle as TimerHandle & { unref?: () => void }).unref?.()
  })
}
