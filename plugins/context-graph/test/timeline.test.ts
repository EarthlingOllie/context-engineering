// timeline: decision steps and snapshots (v3 design.md 4.2, feature v3-06).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyDesignOps, applyUmlOps, emptyUml, parseDesignSeed } from '../src/core/uml.ts'
import { emptyModel } from '../src/core/solution.ts'
import { snapshotAt, timeline } from '../src/core/timeline.ts'
import type { DesignOp, UmlModel, UmlOp } from '../src/core/types.ts'
import { bestMs } from './helpers.ts'

const dec = (label: string): DesignOp => ({ op: 'add', kind: 'decision', label })
const add = (name: string, decision: string, extra: Record<string, unknown> = {}) => ({ op: 'uml.add', decision, kind: 'component', name, ...extra }) as UmlOp
const design = (ops: DesignOp[]) => applyDesignOps({ sol: emptyModel(), uml: emptyUml() }, ops).state

const small = () => design([
  dec('A'), dec('B'),
  add('X', 'decision:a'), add('Y', 'decision:a'),
  { op: 'uml.relate', decision: 'decision:a', kind: 'dependency', from: 'uml:x', to: 'uml:y' },
  add('Z', 'decision:b'),
  add('X', 'decision:a', { operations: ['go()'] }),
  { op: 'abandon', id: 'decision:b', reason: 'no' },
])

const fixture = () => {
  const seed = parseDesignSeed(readFileSync(new URL('./fixtures/uml-small.json', import.meta.url), 'utf8'))
  assert.deepEqual(seed.errors, [])
  return design(seed.ops)
}

test('v3-06: one step per run of decision and cascade flag, in log order, with labels', () => {
  const { sol, uml } = small()
  const steps = timeline(uml, sol)
  assert.deepEqual(steps.map((s) => [s.index, s.decision, s.label, s.abandoned, s.from, s.to]), [
    [1, 'decision:a', 'A', false, 0, 3],
    [2, 'decision:b', 'B', false, 3, 4],
    [3, 'decision:a', 'A', false, 4, 5],
    [4, 'decision:b', 'B (abandoned)', true, 5, 6],
  ])
  assert.deepEqual(steps[0]!.changes, { added: ['uml:x', 'uml:y', 'uml:x|dependency|uml:y'], changed: [], removed: [] })
  assert.deepEqual(steps[2]!.changes, { added: [], changed: ['uml:x'], removed: [] })
  assert.deepEqual(steps[3]!.changes, { added: [], changed: [], removed: ['uml:z'] })
  assert.equal(timeline(uml)[0]!.label, 'decision:a', 'label falls back to the id without a solution model')
})

test('v3-06: a target added and removed in one step is only listed as removed', () => {
  const { sol, uml } = design([dec('A'), add('X', 'decision:a'), add('X', 'decision:a', { operations: ['f()'] }), { op: 'uml.remove', decision: 'decision:a', reason: 'r', id: 'uml:x' }])
  assert.deepEqual(timeline(uml, sol)[0]!.changes, { added: [], changed: [], removed: ['uml:x'] })
})

test('v3-06: snapshots replay the log step by step, clamped', () => {
  for (const { uml } of [small(), fixture()]) {
    const steps = timeline(uml)
    assert.deepEqual(snapshotAt(uml, 0), { elements: {}, relations: {} })
    assert.deepEqual(snapshotAt(uml, -3), { elements: {}, relations: {} })
    assert.deepEqual(snapshotAt(uml, steps.length), { elements: uml.elements, relations: uml.relations })
    assert.deepEqual(snapshotAt(uml, steps.length + 5), { elements: uml.elements, relations: uml.relations })
    const seen = new Set<string>()
    for (let k = 1; k <= steps.length; k++) {
      for (const t of steps[k - 1]!.changes.added) if (!t.includes('|')) seen.add(t)
      assert.deepEqual(Object.keys(snapshotAt(uml, k).elements).sort(), [...seen].sort(), `step ${k}`)
    }
  }
  const { uml } = small()
  assert.equal(snapshotAt(uml, 2).elements['uml:z']!.status, 'active')
  assert.equal(snapshotAt(uml, 4).elements['uml:z']!.status, 'removed')
  assert.equal(snapshotAt(uml, 1).elements['uml:x']!.members.length, 0)
})

// Steps are decision runs: 4000 entries in runs of 40 (100 steps). Each snapshot is an incremental replay plus
// one shallow copy of the records, so the cost is entries + steps x records; a 4000-step log is ~1 s.
test('v3-06: 4000 log entries -> timeline and every snapshot under 150 ms', () => {
  const ctx = { decision: (id: string) => ({ status: 'active' as const, label: id }), solSeq: 0 }
  const ops: UmlOp[] = []
  for (let i = 0; i < 300; i++) ops.push(add(`E${i}`, `decision:d${Math.floor(i / 40) % 7}`, { id: `uml:e${i}` }))
  for (let i = 0; ops.length < 4000; i++) {
    const a = i % 300
    const b = (i * 7 + 1) % 300
    if (a !== b) ops.push({ op: 'uml.relate', decision: `decision:d${Math.floor(ops.length / 40) % 7}`, kind: 'association', from: `uml:e${a}`, to: `uml:e${b}`, label: `l${i}` })
  }
  const u: UmlModel = applyUmlOps(emptyUml(), ops, ctx).model
  assert.equal(u.log.length, 4000)
  // a fresh copy per run: snapshotAt caches per model object
  const copies = Array.from({ length: 4 }, () => structuredClone(u))
  let i = 0
  const ms = bestMs(() => { const c = copies[i++]!; const st = timeline(c); for (let k = 0; k <= st.length; k++) snapshotAt(c, k) }, 3, 1)
  const steps = timeline(u)
  assert.equal(steps.length, 100)
  assert.ok(ms < 150, `${ms.toFixed(1)} ms`)
  assert.deepEqual(snapshotAt(u, steps.length), { elements: u.elements, relations: u.relations })
})
