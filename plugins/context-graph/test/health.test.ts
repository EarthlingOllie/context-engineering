// health: context health of solution nodes from their evidence (v2 design.md 4.4, feature v2-08).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGraph } from '../src/core/ingest.ts'
import { applyOps, emptyModel } from '../src/core/solution.ts'
import { health } from '../src/core/health.ts'

// session-small.jsonl compacts after turn:msg_4; prompt:p2 / turn:msg_5 onwards are in the window.
const g = buildGraph(readFileSync(new URL('./fixtures/session-small.jsonl', import.meta.url), 'utf8'))

const model = applyOps(emptyModel(), [
  { op: 'add', kind: 'goal', label: 'G', evidence: ['turn:msg_5'] },
  { op: 'add', kind: 'component', label: 'Old', evidence: ['turn:msg_1', 'tool:t1'] },
  { op: 'add', kind: 'decision', label: 'Ghost', evidence: ['turn:nope'] },
  { op: 'add', kind: 'risk', label: 'Bare' },
  { op: 'add', kind: 'requirement', label: 'Mixed', evidence: ['prompt:p2', 'turn:msg_2'] },
  { op: 'add', kind: 'assumption', label: 'Dropped', evidence: ['turn:msg_6'] },
  { op: 'abandon', id: 'assumption:dropped', reason: 'wrong' },
]).model

test('v2-08: node state follows the best evidence: in-window, then compacted, then never-loaded', () => {
  const h = health(model, g)
  assert.equal(h.byNode['goal:g']!.state, 'in-window')
  assert.equal(h.byNode['component:old']!.state, 'compacted')
  assert.equal(h.byNode['decision:ghost']!.state, 'never-loaded')
  assert.equal(h.byNode['risk:bare']!.state, 'never-loaded')
  assert.deepEqual(h.byNode['requirement:mixed'], { state: 'in-window', inWindow: 1, compacted: 1, missing: 0 })
  assert.deepEqual(h.byNode['component:old'], { state: 'compacted', inWindow: 0, compacted: 2, missing: 0 })
  assert.deepEqual(h.byNode['decision:ghost'], { state: 'never-loaded', inWindow: 0, compacted: 0, missing: 1 })
})

test('v2-08: abandoned nodes are in byNode but not in totals; totals sum to the live nodes', () => {
  const h = health(model, g)
  assert.equal(h.byNode['assumption:dropped']!.state, 'in-window')
  assert.deepEqual(h.totals, { 'in-window': 2, compacted: 1, 'never-loaded': 2 })
  assert.equal(Object.keys(h.byNode).length, 6)
})

test('v2-08: empty model gives zero totals', () => {
  assert.deepEqual(health(emptyModel(), g), { byNode: {}, totals: { 'in-window': 0, compacted: 0, 'never-loaded': 0 } })
})
