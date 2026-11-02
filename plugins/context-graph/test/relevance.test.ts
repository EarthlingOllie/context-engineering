// relevance: focus the solution layer on what the current question touches (v2 design.md 4.3, feature v2-07).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyGraph } from '../src/core/ingest.ts'
import { applyOps, emptyModel } from '../src/core/solution.ts'
import { relevance } from '../src/core/relevance.ts'
import type { BlastRadius, Focus, SolOp, SolutionModel } from '../src/core/types.ts'

const g = emptyGraph()
const noBlast: BlastRadius = { weights: {}, hops: {}, seeds: [], tokens: 0, centroidIds: [] }
const blast: BlastRadius = { weights: { 'prompt:p9': 1, 'turn:hot': 0.5, 'turn:cold': 0.2 }, hops: {}, seeds: ['prompt:p9'], tokens: 0, centroidIds: [] }
const modelFocus = (...ids: string[]): Focus => ({ seeds: ids.map((id) => ({ id, source: 'model' as const })) })
const noFocus: Focus = { seeds: [] }

const OPS: SolOp[] = [
  { op: 'add', kind: 'goal', label: 'G' },
  { op: 'add', kind: 'component', label: 'A', evidence: ['turn:hot'] },
  { op: 'add', kind: 'component', label: 'B', evidence: ['turn:cold'] },
  { op: 'add', kind: 'constraint', label: 'C' },
  { op: 'add', kind: 'decision', label: 'D' },
  { op: 'add', kind: 'requirement', label: 'U' },
  { op: 'add', kind: 'decision', label: 'Old' },
  { op: 'add', kind: 'assumption', label: 'Gone' },
  { op: 'link', from: 'constraint:c', to: 'component:a', kind: 'constrains' },
  { op: 'link', from: 'component:a', to: 'decision:d', kind: 'decided-by' },
  { op: 'link', from: 'decision:d', to: 'component:b', kind: 'depends-on' },
  { op: 'link', from: 'component:a', to: 'decision:old', kind: 'contradicts' },
  { op: 'abandon', id: 'decision:old', reason: 'dropped' },
  { op: 'abandon', id: 'assumption:gone', reason: 'dropped' },
]
const model = applyOps(emptyModel(), OPS).model

test('v2-07: model focus touches the seed; bearing factors and decisions 0.7; two hops 0.35; goal >= 0.5; rest 0.12', () => {
  const r = relevance(model, g, modelFocus('component:a', 'turn:hot'), noBlast)
  assert.equal(r.reason, 'model')
  assert.deepEqual(r.touched, ['component:a'])
  assert.equal(r.weights['component:a'], 1)
  assert.equal(r.weights['constraint:c'], 0.7)
  assert.equal(r.weights['decision:d'], 0.7)
  assert.ok(r.bearing.includes('constraint:c') && r.bearing.includes('decision:d'))
  assert.equal(r.weights['component:b'], 0.35)
  assert.ok(r.weights['goal:g']! >= 0.5)
  assert.equal(r.weights['requirement:u'], 0.12)
})

test('v2-07: abandoned nodes are capped at 0.4 when bearing and 0.08 otherwise', () => {
  const r = relevance(model, g, modelFocus('component:a'), noBlast)
  assert.ok(r.bearing.includes('decision:old'))
  assert.ok(r.weights['decision:old']! <= 0.4 && r.weights['decision:old']! > 0.08)
  assert.equal(r.weights['assumption:gone'], 0.08)
})

test('v2-07: with no model seeds the prompt blast picks touched nodes via supported-by (>= 0.25); evidence keeps 0.6 x blast', () => {
  const r = relevance(model, g, noFocus, blast)
  assert.equal(r.reason, 'prompt')
  assert.deepEqual(r.touched, ['component:a'])
  assert.equal(r.weights['turn:hot'], 0.3)
  assert.equal(r.weights['prompt:p9'], 0.6)
  assert.notEqual(r.weights['component:b'], 1)
})

test('v2-07: with neither, nodes changed since the prompt began are touched (recent); with nothing, reason none', () => {
  const started: SolutionModel = { ...model, promptSeq: model.seq }
  const later = applyOps(started, [{ op: 'add', kind: 'question', label: 'Q' }]).model
  const r = relevance(later, g, noFocus, noBlast)
  assert.equal(r.reason, 'recent')
  assert.deepEqual(r.touched, ['question:q'])
  assert.equal(r.weights['question:q'], 1)

  const none = relevance(started, g, noFocus, noBlast)
  assert.equal(none.reason, 'none')
  assert.deepEqual(none.touched, [])
  assert.equal(none.weights['goal:g'], 0.5)
  assert.equal(none.weights['component:a'], 0.12)
})

test('v2-07: empty model gives no weights and reason none', () => {
  assert.deepEqual(relevance(emptyModel(), g, modelFocus('component:a'), blast), { weights: {}, touched: [], bearing: [], reason: 'none' })
})

test('v2-07: output does not depend on edge order and covers every solution id', () => {
  const shuffled: SolutionModel = { ...model, edges: [...model.edges].reverse() }
  const rotated: SolutionModel = { ...model, edges: [...model.edges.slice(3), ...model.edges.slice(0, 3)] }
  const a = relevance(model, g, modelFocus('component:a'), blast)
  assert.deepEqual(relevance(shuffled, g, modelFocus('component:a'), blast), a)
  assert.deepEqual(relevance(rotated, g, modelFocus('component:a'), blast), a)
  for (const id of Object.keys(model.nodes)) assert.equal(typeof a.weights[id], 'number', id)
})
