import assert from 'node:assert/strict'
import test from 'node:test'
import { TurnTracker } from '../src/client/turn.ts'

function status(running: boolean | undefined): Map<string, { running?: boolean }> {
  return new Map([['s1', { running }]])
}

test('turn tracker ignores the first baseline and reports true -> false once', () => {
  const tracker = new TurnTracker()
  assert.deepEqual(tracker.update(status(false)), [])
  assert.deepEqual(tracker.update(status(true)), [])
  assert.deepEqual(tracker.update(status(true)), [])
  assert.deepEqual(tracker.update(status(false)), ['s1'])
  assert.deepEqual(tracker.update(status(false)), [])
  assert.deepEqual(tracker.update(status(true)), [])
  assert.deepEqual(tracker.update(status(false)), ['s1'])
})

test('turn tracker ignores undefined and startup-completed sessions', () => {
  const tracker = new TurnTracker()
  assert.deepEqual(tracker.update(status(undefined)), [])
  assert.deepEqual(tracker.update(status(false)), [])
  assert.deepEqual(tracker.update(status(true)), [])
  assert.deepEqual(tracker.update(status(undefined)), [])
  assert.deepEqual(tracker.update(status(false)), [])
  tracker.clear()
  assert.deepEqual(tracker.update(status(false)), [])
})
