// uml: the UML reducer and the design entry point (v3 design.md 4.1, features v3-01..v3-05).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyDesignOps, applyUmlOps, emptyUml, parseDesignSeed, toDesignSeed, umlSlug } from '../src/core/uml.ts'
import { applyOps, emptyModel, parseSeed, toSeed } from '../src/core/solution.ts'
import { timeline } from '../src/core/timeline.ts'
import type { UmlCtx } from '../src/core/uml.ts'
import type { DesignOp, DesignState, SolOp, UmlModel, UmlOp } from '../src/core/types.ts'

const D = 'decision:d'
const E = 'decision:e'
const decisions: Record<string, { status: 'active' | 'abandoned'; label: string }> = {
  [D]: { status: 'active', label: 'D' },
  [E]: { status: 'active', label: 'E' },
  'decision:gone': { status: 'abandoned', label: 'Gone' },
}
const ctx: UmlCtx = { decision: (id) => decisions[id], solSeq: 7 }
const run = (ops: unknown[], u: UmlModel = emptyUml(), c: UmlCtx = ctx) => applyUmlOps(u, ops as UmlOp[], c)
const add = (name: string, kind: 'component' | 'class' | 'interface' = 'component', extra: Partial<UmlOp> = {}, decision = D) =>
  ({ op: 'uml.add', decision, kind, name, ...extra }) as UmlOp

test('v3-01: umlSlug splits camelCase and is never empty', () => {
  assert.equal(umlSlug('SvgRenderer'), 'svg-renderer')
  assert.equal(umlSlug('HTTPServer2'), 'httpserver2')
  assert.equal(umlSlug('three.js (full)'), 'three-js-full')
  assert.equal(umlSlug('!!!'), 'node')
})

test('v3-01: uml.add creates an active element with one added log entry', () => {
  const { model, results } = run([add('SvgRenderer')])
  const el = model.elements['uml:svg-renderer']!
  assert.equal(el.status, 'active')
  assert.equal(el.kind, 'component')
  assert.deepEqual(el.decisions, [D])
  assert.deepEqual(model.log.map((e) => ({ change: e.change, target: e.target, decision: e.decision, solSeq: e.solSeq })), [
    { change: 'added', target: 'uml:svg-renderer', decision: D, solSeq: 7 },
  ])
  assert.deepEqual(results, [{ i: 0, op: 'uml.add', ok: true, id: 'uml:svg-renderer', change: 'added' }])
})

test('v3-01: an unknown decision or a non-decision fails and returns the input', () => {
  const u = emptyUml()
  const c: UmlCtx = { decision: (id) => (id === 'component:x' ? undefined : decisions[id]), solSeq: 1 }
  const { model, results } = run([add('X', 'component', {}, 'decision:nope'), add('Y', 'component', {}, 'component:x')], u, c)
  assert.equal(model, u)
  assert.deepEqual(results.map((r) => r.error), ['unknown-decision', 'unknown-decision'])
})

test('v3-01: citing an abandoned decision is ok with a warning', () => {
  const { results } = run([add('X', 'component', {}, 'decision:gone')])
  assert.equal(results[0]!.ok, true)
  assert.deepEqual(results[0]!.warnings, ['decision-abandoned'])
})

test('v3-01: re-add merges members by (kind, name), appends the decision once and logs changed', () => {
  const a = run([add('SvgRenderer', 'component', { operations: ['+renderSvg(scene) string'] })]).model
  const { model, results } = run([
    add('SvgRenderer', 'component', { operations: ['+renderSvg(scene, o) string', '+escape(s)'] }, E),
    add('SvgRenderer', 'component', { operations: ['+escape(s)'] }, E),
  ], a)
  const el = model.elements['uml:svg-renderer']!
  assert.deepEqual(el.members.map((m) => [m.name, m.text]), [['renderSvg', '+renderSvg(scene, o) string'], ['escape', '+escape(s)']])
  assert.deepEqual(el.decisions, [D, E])
  assert.deepEqual(model.log.map((e) => e.change), ['added', 'changed'])
  assert.equal(results[0]!.change, 'changed')
  assert.deepEqual(results[1]!.warnings, ['duplicate'])
  assert.equal(results[1]!.change, undefined)
})

test('v3-01: an identical re-add is a duplicate and logs nothing', () => {
  const a = run([add('X', 'class', { attributes: ['a: number'] })]).model
  const { model, results } = run([add('X', 'class', { attributes: ['a: number'] })], a)
  assert.equal(model, a)
  assert.deepEqual(results[0]!.warnings, ['duplicate'])
})

test('v3-01: kind-mismatch, name and member cuts, member names after visibility', () => {
  const a = run([add('X', 'class')]).model
  assert.equal(run([add('X', 'interface')], a).results[0]!.error, 'kind-mismatch')
  const long = 'N'.repeat(100)
  const { model } = run([add(long, 'class', { id: 'uml:long', operations: ['#protectedOp(' + 'a, '.repeat(40) + ')'], attributes: ['-secret: string'] })])
  const el = model.elements['uml:long']!
  assert.equal(el.name.length, 60)
  assert.ok(el.name.endsWith('…'))
  const op = el.members.find((m) => m.kind === 'operation')!
  assert.equal(op.name, 'protectedOp')
  assert.equal(op.text.length, 80)
  assert.ok(op.text.endsWith('…'))
  assert.equal(el.members.find((m) => m.kind === 'attribute')!.name, 'secret')
  assert.equal(run([add('Y', 'class', { operations: ['+renderSvg(scene) string'] })]).model.elements['uml:y']!.members[0]!.name, 'renderSvg')
})

test('v3-01: the 25th member fails cap', () => {
  const ops = Array.from({ length: 24 }, (_, i) => `m${i}()`)
  const a = run([add('X', 'class', { operations: ops })]).model
  assert.equal(a.elements['uml:x']!.members.length, 24)
  const { model, results } = run([add('X', 'class', { operations: ['m24()'] })], a)
  assert.equal(results[0]!.error, 'cap')
  assert.equal(model, a)
})

test('v3-01: applyUmlOps never throws on garbage and returns the input by identity', () => {
  const u = emptyUml()
  for (const ops of [[null], [{}], [{ op: 'uml.x', decision: D }], [{ op: 'uml.add', decision: D, kind: 'component' }], [42]]) {
    const { model, results } = run(ops, u)
    assert.equal(model, u)
    assert.equal(results[0]!.ok, false)
    assert.equal(results[0]!.error, 'bad-op')
  }
  for (const ops of [null, undefined, 'x', {}]) assert.equal(applyUmlOps(u, ops as unknown as UmlOp[], ctx).model, u)
  assert.equal(applyUmlOps(u, [add('X')], { decision: () => { throw new Error('boom') }, solSeq: 0 }).model, u)
})

// ---- v3-02: relations ----
const KINDS = ['component', 'class', 'interface'] as const
const REL_KINDS = ['association', 'dependency', 'realization', 'composition', 'generalization'] as const
const ALLOWED: Record<string, (a: string, b: string) => boolean> = {
  association: () => true,
  dependency: () => true,
  realization: (a, b) => a !== 'interface' && b === 'interface',
  composition: (a) => a !== 'interface',
  generalization: (a, b) => a !== 'component' && a === b,
}
const three = () => run(KINDS.flatMap((k) => [add(`${k} A`, k, { id: `uml:${k}-a` }), add(`${k} B`, k, { id: `uml:${k}-b` })])).model
const rel = (from: string, kind: string, to: string, extra: Record<string, unknown> = {}, decision = D) =>
  ({ op: 'uml.relate', decision, kind, from, to, ...extra }) as UmlOp

test('v3-02: the full (from-kind, relation, to-kind) sweep follows the rules table', () => {
  const base = three()
  for (const a of KINDS) for (const k of REL_KINDS) for (const b of KINDS) {
    const { model, results } = run([rel(`uml:${a}-a`, k, `uml:${b}-b`)], base)
    const want = ALLOWED[k]!(a, b)
    assert.equal(results[0]!.ok, want, `${a} ${k} ${b}`)
    if (want) assert.ok(model.relations[`uml:${a}-a|${k}|uml:${b}-b`], 'relation id is from|kind|to')
    else assert.equal(results[0]!.error, 'bad-relation')
  }
})

test('v3-02: missing ends, self relations', () => {
  const base = three()
  assert.equal(run([rel('uml:class-a', 'dependency', 'uml:nope')], base).results[0]!.error, 'unknown-id')
  assert.equal(run([rel('uml:class-a', 'association', 'uml:class-a')], base).results[0]!.ok, true)
  for (const k of ['dependency', 'composition', 'generalization']) assert.equal(run([rel('uml:class-a', k, 'uml:class-a')], base).results[0]!.error, 'bad-relation', k)
  assert.equal(run([rel('uml:component-a', 'dependency', 'uml:component-a')], base).results[0]!.error, 'bad-relation')
})

test('v3-02: duplicate relate warns without logging, a changed label logs changed', () => {
  const a = run([rel('uml:class-a', 'dependency', 'uml:class-b', { label: 'uses' })], three()).model
  const dup = run([rel('uml:class-a', 'dependency', 'uml:class-b', { label: 'uses' })], a)
  assert.equal(dup.model, a)
  assert.deepEqual(dup.results[0]!.warnings, ['duplicate'])
  const changed = run([rel('uml:class-a', 'dependency', 'uml:class-b', { label: 'calls' })], a)
  assert.equal(changed.model.log.at(-1)!.change, 'changed')
  assert.equal(changed.model.relations['uml:class-a|dependency|uml:class-b']!.label, 'calls')
})

test('v3-02: uml.add with in sets owner and upserts the composition, citing the same decision', () => {
  const base = run([add('Owner')]).model
  const { model, results } = run([add('Part', 'interface', { in: 'uml:owner' }, E)], base)
  assert.equal(results[0]!.ok, true)
  assert.equal(model.elements['uml:part']!.owner, 'uml:owner')
  const r = model.relations['uml:owner|composition|uml:part']!
  assert.deepEqual(r.decisions, [E])
  assert.deepEqual(model.log.slice(-2).map((e) => [e.target, e.change, e.decision]), [
    ['uml:part', 'added', E],
    ['uml:owner|composition|uml:part', 'added', E],
  ])
  const withClass = run([add('K', 'class')], base).model
  for (const owner of ['uml:k', 'uml:missing']) {
    const out = run([add('Part', 'interface', { in: owner })], withClass)
    assert.equal(out.results[0]!.error, 'bad-relation')
    assert.equal(out.model, withClass)
  }
})

// ---- v3-03: remove ----
const rm = (extra: Record<string, unknown>, reason = 'gone', decision = D) => ({ op: 'uml.remove', decision, reason, ...extra }) as UmlOp

test('v3-03: remove needs a reason and exactly one target', () => {
  const a = run([rel('uml:class-a', 'dependency', 'uml:class-b')], three()).model
  assert.equal(run([rm({ id: 'uml:class-a' }, '  ')], a).results[0]!.error, 'reason-required')
  for (const t of [{}, { id: 'uml:class-a', from: 'uml:class-a', kind: 'dependency', to: 'uml:class-b' }, { member: 'x' }, { from: 'uml:class-a', to: 'uml:class-b' }]) {
    assert.equal(run([rm(t)], a).results[0]!.error, 'bad-op', JSON.stringify(t))
  }
})

test('v3-03: remove an element keeps its relations, logs removed; twice warns already-removed', () => {
  const a = run([rel('uml:class-a', 'dependency', 'uml:class-b')], three()).model
  const { model, results } = run([rm({ id: 'uml:class-a' }, 'not needed', E)], a)
  const el = model.elements['uml:class-a']!
  assert.equal(el.status, 'removed')
  assert.equal(el.reason, 'not needed')
  assert.equal(model.relations['uml:class-a|dependency|uml:class-b']!.status, 'active')
  assert.deepEqual([model.log.at(-1)!.target, model.log.at(-1)!.change], ['uml:class-a', 'removed'])
  assert.equal(results[0]!.change, 'removed')
  const again = run([rm({ id: 'uml:class-a' })], model)
  assert.equal(again.model, model)
  assert.deepEqual(again.results[0]!.warnings, ['already-removed'])
})

test('v3-03: remove a member or a relation', () => {
  const a = run([add('X', 'class', { attributes: ['a: number'], operations: ['go()'] }), add('Y', 'class'), rel('uml:x', 'association', 'uml:y')]).model
  const m = run([rm({ id: 'uml:x', member: 'go' })], a).model
  assert.deepEqual(m.elements['uml:x']!.members.map((x) => [x.name, x.status]), [['a', 'active'], ['go', 'removed']])
  assert.equal(m.elements['uml:x']!.status, 'active')
  assert.equal(m.log.at(-1)!.target, 'uml:x.go')
  assert.equal(run([rm({ id: 'uml:x', member: 'nope' })], a).results[0]!.error, 'unknown-member')
  const r = run([rm({ from: 'uml:x', kind: 'association', to: 'uml:y' })], a).model
  assert.equal(r.relations['uml:x|association|uml:y']!.status, 'removed')
  assert.equal(run([rm({ from: 'uml:y', kind: 'association', to: 'uml:x' })], a).results[0]!.error, 'unknown-id')
})

test('v3-03: re-adding a removed element revives it', () => {
  const a = run([add('X'), rm({ id: 'uml:x' })]).model
  const { model, results } = run([add('X')], a)
  assert.equal(model.elements['uml:x']!.status, 'active')
  assert.equal(model.elements['uml:x']!.reason, undefined)
  assert.equal(model.log.at(-1)!.change, 'changed')
  assert.deepEqual(results[0]!.warnings, ['revived'])
})

test('v3-03: caps on elements, relations and the log', () => {
  const els = run(Array.from({ length: 300 }, (_, i) => add(`E${i}`, 'class', { id: `uml:e${i}` }))).model
  assert.equal(Object.keys(els.elements).length, 300)
  assert.equal(run([add('One more', 'class')], els).results[0]!.error, 'cap')
  const pairs: UmlOp[] = []
  for (let i = 0; pairs.length < 1000; i++) for (let j = i + 1; j < 300 && pairs.length < 1000; j++) pairs.push(rel(`uml:e${i}`, 'dependency', `uml:e${j}`))
  const rels = run(pairs, els).model
  assert.equal(Object.keys(rels.relations).length, 1000)
  assert.equal(run([rel('uml:e299', 'dependency', 'uml:e0')], rels).results[0]!.error, 'cap')
  // 1300 entries so far; toggle one relation 2700 times to reach 4000.
  const toggles: UmlOp[] = []
  for (let k = 0; k < 1350; k++) toggles.push(rm({ from: 'uml:e0', kind: 'dependency', to: 'uml:e1' }), rel('uml:e0', 'dependency', 'uml:e1'))
  const full = run(toggles, rels).model
  assert.equal(full.log.length, 4000)
  const over = run([rm({ id: 'uml:e5' })], full)
  assert.equal(over.results[0]!.error, 'cap')
  assert.equal(over.model, full)
})

// ---- v3-04: applyDesignOps ----
const emptyState = (): DesignState => ({ sol: emptyModel(), uml: emptyUml() })

test('v3-04: mixed ops keep indexes and abandoning a decision cascades into its UML', () => {
  const ops: DesignOp[] = [
    { op: 'add', kind: 'goal', label: 'G' },
    { op: 'add', kind: 'decision', label: 'D' },
    add('X', 'component', {}, D),
    { op: 'add', kind: 'decision', label: 'E' },
    add('X', 'component', { operations: ['go()'] }, E),
    add('Y', 'component', {}, D),
    { op: 'abandon', id: D, reason: 'wrong path' },
  ]
  const { state, results } = applyDesignOps(emptyState(), ops)
  assert.deepEqual(results.map((r) => [r.i, r.op, r.ok]), [
    [0, 'add', true], [1, 'add', true], [2, 'uml.add', true], [3, 'add', true], [4, 'uml.add', true], [5, 'uml.add', true],
    [6, 'abandon', true], [6, 'uml.cascade', true],
  ])
  assert.deepEqual(results[7]!.cascaded, ['uml:y'])
  assert.equal(results[4]!.change, 'changed')
  assert.equal(state.uml.elements['uml:y']!.status, 'removed')
  assert.equal(state.uml.elements['uml:x']!.status, 'active')
  const last = state.uml.log.at(-1)!
  assert.deepEqual([last.cascade, last.decision, last.target, (last.op as { reason: string }).reason], [true, D, 'uml:y', 'wrong path'])
  assert.deepEqual(state.uml.log.slice(0, 3).map((e) => e.solSeq), [2, 3, 3])
})

test('v3-04: a UML op before its decision fails while later ops still run; nothing succeeding returns the input', () => {
  const { results } = applyDesignOps(emptyState(), [add('X'), { op: 'add', kind: 'decision', label: 'D' }, add('X')])
  assert.deepEqual(results.map((r) => r.error ?? 'ok'), ['unknown-decision', 'ok', 'ok'])
  const s = emptyState()
  assert.equal(applyDesignOps(s, [add('X'), { op: 'link', from: 'a:b', to: 'c:d', kind: 'constrains' }]).state, s)
  assert.equal(applyDesignOps(s, null as unknown as DesignOp[]).state, s)
})

test('v3-04: solution ops behave exactly as v2 applyOps on the v2 fixture', () => {
  const seed = parseSeed(readFileSync(new URL('./fixtures/solution-small.json', import.meta.url), 'utf8'))
  const isEvidence = (id: string) => !id.startsWith('prompt:p9')
  const v2 = applyOps(emptyModel(), seed.ops, { isEvidence })
  const v3 = applyDesignOps(emptyState(), seed.ops, { isEvidence })
  assert.deepEqual(v3.state.sol, v2.model)
  assert.deepEqual(v3.results, v2.results)
  assert.equal(v3.state.uml.log.length, 0)
})

// ---- v3-05: seed @2 ----
const fixtureText = () => readFileSync(new URL('./fixtures/uml-small.json', import.meta.url), 'utf8')
const noSeq = (r: Record<string, { createdSeq: number; updatedSeq: number }>) =>
  Object.fromEntries(Object.entries(r).map(([k, { createdSeq: _c, updatedSeq: _u, ...rest }]) => [k, rest]))
const stepShape = (s: ReturnType<typeof timeline>) => s.map((x) => ({ decision: x.decision, abandoned: x.abandoned, changes: x.changes }))

test('v3-05: parseDesignSeed accepts @1 and @2, rejects other formats, drops malformed ops, never throws', () => {
  const v1 = parseDesignSeed(JSON.stringify({ format: 'context-graph/solution@1', ops: [{ op: 'add', kind: 'goal', label: 'G' }, add('X')] }))
  assert.equal(v1.ops.length, 1)
  assert.equal(v1.errors.length, 1, 'uml ops are malformed in an @1 seed')
  const v2 = parseDesignSeed(JSON.stringify({ format: 'context-graph/solution@2', title: 'T', ops: [{ op: 'add', kind: 'goal', label: 'G' }, add('X'), { op: 'uml.add', kind: 'component' }, 7] }))
  assert.equal(v2.title, 'T')
  assert.deepEqual(v2.ops.map((o) => o.op), ['add', 'uml.add'])
  assert.equal(v2.errors.length, 2)
  const bad = parseDesignSeed(JSON.stringify({ format: 'context-graph/solution@3', ops: [] }))
  assert.deepEqual(bad.ops, [])
  assert.match(bad.errors[0]!, /format/)
  for (const s of ['', 'not json', '[]', 'null', '{"format":1}']) assert.doesNotThrow(() => parseDesignSeed(s))
})

test('v3-05: the fixture covers every kind, relation kind, remove form, in-sugar, revive and cascade', () => {
  const seed = parseDesignSeed(fixtureText())
  assert.deepEqual(seed.errors, [])
  const { state, results } = applyDesignOps(emptyState(), seed.ops)
  assert.deepEqual(results.filter((r) => !r.ok), [])
  const u = state.uml
  assert.deepEqual([...new Set(Object.values(u.elements).map((e) => e.kind))].sort(), ['class', 'component', 'interface'])
  assert.deepEqual([...new Set(Object.values(u.relations).map((r) => r.kind))].sort(), ['association', 'composition', 'dependency', 'generalization', 'realization'])
  assert.ok(results.some((r) => r.warnings?.includes('revived')))
  const cascade = results.find((r) => r.op === 'uml.cascade')!
  assert.deepEqual(cascade.cascaded, ['uml:gl-renderer', 'uml:renderer.renderGl', 'uml:renderer|composition|uml:gl-renderer', 'uml:gl-renderer|realization|uml:drawable'])
  assert.equal(u.elements['uml:options']!.owner, 'uml:renderer')
  const removes = u.log.filter((e) => e.op.op === 'uml.remove' && !e.cascade).map((e) => e.target)
  assert.deepEqual(removes, ['uml:shape', 'uml:options.width', 'uml:renderer|association|uml:base-shape'])
})

test('v3-05: toDesignSeed round-trips the models and the timeline, deterministically', () => {
  const { state } = applyDesignOps(emptyState(), parseDesignSeed(fixtureText()).ops)
  const text = toDesignSeed(state.sol, state.uml)
  assert.equal(toDesignSeed(state.sol, state.uml), text)
  const again = parseDesignSeed(text)
  assert.deepEqual(again.errors, [])
  const back = applyDesignOps(emptyState(), again.ops)
  assert.deepEqual(back.results.filter((r) => !r.ok), [])
  assert.deepEqual(noSeq(back.state.uml.elements), noSeq(state.uml.elements))
  assert.deepEqual(noSeq(back.state.uml.relations), noSeq(state.uml.relations))
  const v2 = applyOps(emptyModel(), parseSeed(toSeed(state.sol)).ops as SolOp[]).model
  assert.deepEqual(back.state.sol.nodes, v2.nodes)
  assert.deepEqual(back.state.sol.edges, v2.edges)
  assert.deepEqual(stepShape(timeline(back.state.uml, back.state.sol)), stepShape(timeline(state.uml, state.sol)))
  assert.equal(timeline(back.state.uml, back.state.sol).filter((s) => s.abandoned).length, 1)
})
