// solution: the solution-model reducer (v2 design.md 4.1, features v2-01..v2-05).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyOps, emptyModel, parseSeed, toSeed } from '../src/core/solution.ts'
import type { SolOp, SolutionModel } from '../src/core/types.ts'

const run = (ops: SolOp[], m: SolutionModel = emptyModel(), ctx?: { isEvidence?: (id: string) => boolean }) => applyOps(m, ops, ctx)

test('v2-01: add creates goal and component with slug ids and bumps seq per op', () => {
  const { model, results } = run([
    { op: 'add', kind: 'goal', label: 'G' },
    { op: 'add', kind: 'component', label: 'Pane' },
  ])
  assert.deepEqual(Object.keys(model.nodes).sort(), ['component:pane', 'goal:g'])
  assert.equal(model.goalId, 'goal:g')
  assert.equal(model.seq, 2)
  assert.deepEqual(results.map((r) => [r.ok, r.id]), [[true, 'goal:g'], [true, 'component:pane']])
})

test('v2-01: re-adding an id is an upsert that keeps createdSeq', () => {
  const a = run([{ op: 'add', kind: 'goal', label: 'G' }, { op: 'add', kind: 'component', label: 'Pane' }]).model
  const { model } = run([{ op: 'add', kind: 'component', id: 'component:pane', label: 'The pane', detail: 'draws svg' }], a)
  const n = model.nodes['component:pane']!
  assert.equal(n.label, 'The pane')
  assert.equal(n.detail, 'draws svg')
  assert.equal(n.createdSeq, 2)
  assert.equal(n.updatedSeq, 3)
})

test('v2-01: kind-mismatch and goal-exists are op errors', () => {
  const a = run([{ op: 'add', kind: 'goal', label: 'G' }, { op: 'add', kind: 'component', label: 'Pane' }]).model
  const { results } = run([
    { op: 'add', kind: 'decision', id: 'component:pane', label: 'x' },
    { op: 'add', kind: 'goal', label: 'Other goal' },
    { op: 'add', kind: 'goal', label: 'G again', id: 'goal:g' },
  ], a)
  assert.deepEqual(results.map((r) => r.error ?? 'ok'), ['kind-mismatch', 'goal-exists', 'ok'])
})

test('v2-01: questions and risks are born open, everything else active', () => {
  const kinds = ['goal', 'component', 'requirement', 'constraint', 'assumption', 'dependency', 'risk', 'decision', 'question'] as const
  const { model } = run(kinds.map((kind) => ({ op: 'add' as const, kind, label: `a ${kind}` })))
  const status = Object.fromEntries(Object.values(model.nodes).map((n) => [n.kind, n.status]))
  assert.deepEqual(status, {
    goal: 'active', component: 'active', requirement: 'active', constraint: 'active', assumption: 'active',
    dependency: 'active', risk: 'open', decision: 'active', question: 'open',
  })
})

test('v2-01: labels over 60 chars are cut with an ellipsis', () => {
  const long = 'x'.repeat(100)
  const { model, results } = run([{ op: 'add', kind: 'component', label: `  ${long}  ` }])
  const n = model.nodes[results[0]!.id!]!
  assert.equal(n.label.length, 60)
  assert.ok(n.label.endsWith('…'))
  assert.match(n.id, /^component:[a-z0-9-]{1,48}$/)
})

test('v2-01: evidence ids become supported-by edges', () => {
  const { model } = run([{ op: 'add', kind: 'constraint', label: 'No WebGL', evidence: ['prompt:p1', 'turn:m1'] }])
  assert.deepEqual(
    model.edges.map((e) => [e.from, e.to, e.kind]),
    [['constraint:no-webgl', 'prompt:p1', 'supported-by'], ['constraint:no-webgl', 'turn:m1', 'supported-by']],
  )
})

test('v2-01: an op list with no success returns the input by identity; garbage never throws', () => {
  const m = emptyModel()
  const garbage = [null, {}, { op: 'x' }, { op: 'add' }, { op: 'add', kind: 'goal', label: '' }, 42] as unknown as SolOp[]
  const { model, results } = run(garbage, m)
  assert.equal(model, m)
  assert.equal(results.length, garbage.length)
  assert.ok(results.every((r) => !r.ok && r.error === 'bad-op'))
  assert.equal(run(undefined as unknown as SolOp[], m).model, m)
})

// ---- v2-02: link rules ----
const ALL = ['goal', 'component', 'requirement', 'constraint', 'assumption', 'dependency', 'risk', 'decision', 'question'] as const
type K = (typeof ALL)[number]
const allNodes = () => run(ALL.map((kind) => ({ op: 'add' as const, kind, label: kind }))).model
// Independent restatement of design.md section 3 "Link rules".
const ALLOWED: Record<'depends-on' | 'constrains' | 'decided-by', { from: K[]; to: K[] }> = {
  'depends-on': { from: ['goal', 'component', 'decision'], to: ['component', 'dependency', 'decision', 'question'] },
  constrains: { from: ['requirement', 'constraint', 'assumption', 'dependency', 'risk', 'question'], to: ['goal', 'component', 'decision'] },
  'decided-by': { from: ['goal', 'component', 'question', 'risk'], to: ['decision'] },
}

test('v2-02: every (from, kind, to) triple follows the link table', () => {
  const m = allNodes()
  for (const [kind, rule] of Object.entries(ALLOWED) as [keyof typeof ALLOWED, { from: K[]; to: K[] }][]) {
    for (const f of ALL) for (const t of ALL) {
      if (f === t) continue
      const r = run([{ op: 'link', from: `${f}:${f}`, to: `${t}:${t}`, kind }], m).results[0]!
      const want = rule.from.includes(f) && rule.to.includes(t)
      assert.equal(r.ok, want, `${f} -${kind}-> ${t}`)
      if (!want) assert.equal(r.error, 'bad-link')
    }
  }
  for (const f of ALL) for (const t of ALL) {
    if (f === t) continue
    assert.ok(run([{ op: 'link', from: `${f}:${f}`, to: `${t}:${t}`, kind: 'contradicts' }], m).results[0]!.ok, `${f} contradicts ${t}`)
  }
  assert.equal(run([{ op: 'link', from: 'risk:risk', to: 'risk:risk', kind: 'contradicts' }], m).results[0]!.error, 'bad-link')
  assert.equal(run([{ op: 'link', from: 'component:component', to: 'decision:decision', kind: 'supported-by' }], m).results[0]!.error, 'bad-link')
  assert.ok(run([{ op: 'link', from: 'component:component', to: 'turn:m1', kind: 'supported-by' }], m).results[0]!.ok)
})

test('v2-02: missing endpoints are unknown-id, except a supported-by target', () => {
  const m = allNodes()
  const r = run([
    { op: 'link', from: 'component:nope', to: 'decision:decision', kind: 'decided-by' },
    { op: 'link', from: 'component:component', to: 'decision:nope', kind: 'decided-by' },
    { op: 'link', from: 'component:nope', to: 'turn:m1', kind: 'supported-by' },
  ], m).results
  assert.deepEqual(r.map((x) => x.error), ['unknown-id', 'unknown-id', 'unknown-id'])
})

test('v2-02: duplicates are ok no-ops; contradicts is normalised from < to', () => {
  const m = allNodes()
  const once = run([{ op: 'link', from: 'risk:risk', to: 'decision:decision', kind: 'contradicts' }], m).model
  assert.deepEqual(once.edges.map((e) => [e.from, e.to]), [['decision:decision', 'risk:risk']])
  const { model, results } = run([{ op: 'link', from: 'decision:decision', to: 'risk:risk', kind: 'contradicts' }], once)
  assert.equal(results[0]!.ok, true)
  assert.deepEqual(results[0]!.warnings, ['duplicate'])
  assert.equal(model.edges.length, 1)
})

test('v2-02: supported-by to an unknown evidence id is stored and warned dangling', () => {
  const m = allNodes()
  const { model, results } = run([{ op: 'link', from: 'goal:goal', to: 'turn:gone', kind: 'supported-by' }], m, { isEvidence: (id) => id === 'turn:here' })
  assert.deepEqual(results[0]!.warnings, ['dangling:turn:gone'])
  assert.equal(model.edges.length, 1)
})

test('v2-02: node cap 200 and 12 supported-by per node', () => {
  const ops: SolOp[] = Array.from({ length: 201 }, (_, i) => ({ op: 'add', kind: 'component', label: `c${i}` }))
  const r = run(ops).results
  assert.equal(r[199]!.ok, true)
  assert.equal(r[200]!.error, 'cap')
  const ev = Array.from({ length: 13 }, (_, i) => ({ op: 'link' as const, from: 'goal:goal', to: `turn:t${i}`, kind: 'supported-by' as const }))
  const r2 = run(ev, allNodes()).results
  assert.equal(r2[11]!.ok, true)
  assert.equal(r2[12]!.error, 'cap')
})

// ---- v2-03: resolve ----
const qModel = () => run([
  { op: 'add', kind: 'goal', label: 'G' },
  { op: 'add', kind: 'component', label: 'Pane' },
  { op: 'add', kind: 'question', label: 'Panes on web?' },
  { op: 'add', kind: 'decision', label: 'Use artifact' },
]).model

test('v2-03: resolve by a decision sets resolved, stores the note and links decided-by', () => {
  const { model, results } = run([{ op: 'resolve', id: 'question:panes-on-web', by: 'decision:use-artifact', note: 'no pane on web', evidence: ['turn:m9'] }], qModel())
  assert.equal(results[0]!.ok, true)
  const q = model.nodes['question:panes-on-web']!
  assert.equal(q.status, 'resolved')
  assert.equal(q.reason, 'no pane on web')
  const edges = model.edges.map((e) => `${e.from} ${e.kind} ${e.to}`)
  assert.ok(edges.includes('question:panes-on-web decided-by decision:use-artifact'))
  assert.ok(edges.includes('question:panes-on-web supported-by turn:m9'))
})

test('v2-03: resolve errors: by a non-decision, a non-resolvable kind, unknown id', () => {
  const m = qModel()
  const bad = run([{ op: 'resolve', id: 'question:panes-on-web', by: 'component:pane' }], m)
  assert.equal(bad.results[0]!.error, 'bad-link')
  assert.equal(bad.model.nodes['question:panes-on-web']!.status, 'open')
  assert.equal(run([{ op: 'resolve', id: 'component:pane' }], m).results[0]!.error, 'not-resolvable')
  assert.equal(run([{ op: 'resolve', id: 'question:nope' }], m).results[0]!.error, 'unknown-id')
})

test('v2-03: resolving twice warns already-resolved', () => {
  const once = run([{ op: 'resolve', id: 'question:panes-on-web' }], qModel()).model
  const r = run([{ op: 'resolve', id: 'question:panes-on-web' }], once).results[0]!
  assert.equal(r.ok, true)
  assert.deepEqual(r.warnings, ['already-resolved'])
})

// ---- v2-04: abandon ----
test('v2-04: abandon keeps the node and every edge touching it', () => {
  const m = run([
    { op: 'add', kind: 'constraint', label: 'No WebGL' },
    { op: 'link', from: 'constraint:no-webgl', to: 'decision:use-artifact', kind: 'constrains' },
    { op: 'link', from: 'decision:use-artifact', to: 'question:panes-on-web', kind: 'depends-on' },
  ], qModel()).model
  const { model, results } = run([{ op: 'abandon', id: 'decision:use-artifact', reason: 'superseded' }], m)
  assert.equal(results[0]!.ok, true)
  const d = model.nodes['decision:use-artifact']!
  assert.equal(d.status, 'abandoned')
  assert.equal(d.reason, 'superseded')
  assert.deepEqual(model.edges, m.edges)
})

test('v2-04: abandon errors and re-adding stays abandoned', () => {
  const m = qModel()
  assert.equal(run([{ op: 'abandon', id: 'component:pane', reason: '  ' }], m).results[0]!.error, 'reason-required')
  assert.equal(run([{ op: 'abandon', id: 'goal:g', reason: 'meh' }], m).results[0]!.error, 'goal-not-abandonable')
  assert.equal(run([{ op: 'abandon', id: 'component:zzz', reason: 'meh' }], m).results[0]!.error, 'unknown-id')
  const gone = run([{ op: 'abandon', id: 'component:pane', reason: 'dropped' }], m).model
  const { model, results } = run([{ op: 'add', kind: 'component', label: 'Pane' }], gone)
  assert.equal(model.nodes['component:pane']!.status, 'abandoned')
  assert.deepEqual(results[0]!.warnings, ['still-abandoned'])
})

// ---- v2-05: seed files ----

const fixtureText = readFileSync(new URL('./fixtures/solution-small.json', import.meta.url), 'utf8')
const strip = (m: SolutionModel) => ({
  goalId: m.goalId,
  title: m.title,
  nodes: Object.fromEntries(Object.entries(m.nodes).map(([id, { createdSeq: _c, updatedSeq: _u, ...rest }]) => [id, rest])),
  edges: m.edges.map(({ seq: _s, ...e }) => `${e.from}|${e.kind}|${e.to}`).sort(),
})

test('v2-05: the fixture applies cleanly and covers every kind, edge kind and status', () => {
  const seed = parseSeed(fixtureText)
  assert.deepEqual(seed.errors, [])
  const { model, results } = applyOps(emptyModel(), seed.ops)
  assert.deepEqual(results.filter((r) => !r.ok), [])
  assert.deepEqual(new Set(Object.values(model.nodes).map((n) => n.kind)).size, 9)
  assert.deepEqual([...new Set(model.edges.map((e) => e.kind))].sort(), ['constrains', 'contradicts', 'decided-by', 'depends-on', 'supported-by'])
  assert.deepEqual([...new Set(Object.values(model.nodes).map((n) => n.status))].sort(), ['abandoned', 'active', 'open', 'resolved'])
})

test('v2-05: parseSeed rejects a wrong or missing format and never throws', () => {
  for (const text of ['{"ops":[]}', '{"format":"other@1","ops":[{"op":"add","kind":"goal","label":"g"}]}']) {
    const r = parseSeed(text)
    assert.deepEqual(r.ops, [])
    assert.match(r.errors[0]!, /format/)
  }
  for (const text of ['not json', '', 'null', '[]', '42']) {
    const r = parseSeed(text)
    assert.deepEqual(r.ops, [])
    assert.ok(r.errors.length > 0)
  }
})

test('v2-05: parseSeed drops malformed ops, keeps valid ones and lists the drops', () => {
  const r = parseSeed(JSON.stringify({
    format: 'context-graph/solution@1',
    title: 'T',
    ops: [{ op: 'add', kind: 'goal', label: 'G' }, { op: 'add', kind: 'nope', label: 'x' }, null, { op: 'link', from: 'a:b' }, { op: 'abandon', id: 'goal:g', reason: 'r' }],
  }))
  assert.equal(r.title, 'T')
  assert.deepEqual(r.ops.map((o) => o.op), ['add', 'abandon'])
  assert.equal(r.errors.length, 3)
  assert.match(r.errors[0]!, /ops\[1\]/)
})

test('v2-05: toSeed round-trips the fixture up to seq numbers', () => {
  const seed = parseSeed(fixtureText)
  const m = { ...applyOps(emptyModel(), seed.ops).model, title: seed.title }
  const again = parseSeed(toSeed(m))
  assert.deepEqual(again.errors, [])
  assert.equal(again.title, m.title)
  const { model, results } = applyOps(emptyModel(), again.ops)
  assert.deepEqual(results.filter((r) => !r.ok), [])
  assert.deepEqual(strip({ ...model, title: again.title }), strip(m))
  assert.equal(again.ops[0]!.op === 'add' && again.ops[0]!.kind, 'goal')
})
