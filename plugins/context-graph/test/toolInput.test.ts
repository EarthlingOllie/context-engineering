// toolInput: context_graph tool input -> SolOp list (v2 design.md 5.4, feature v2-06).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOL_SCHEMA, toolInputToOps } from '../src/core/toolInput.ts'

test('v2-06: add maps to one add op carrying kind, label, detail, id and evidence', () => {
  assert.deepEqual(toolInputToOps({ action: 'add', kind: 'risk', label: 'Pane always dark', evidence: ['turn:m1', 'prompt:p1'] }), {
    ops: [{ op: 'add', kind: 'risk', label: 'Pane always dark', evidence: ['turn:m1', 'prompt:p1'] }],
  })
  assert.deepEqual(toolInputToOps({ action: 'add', kind: 'component', label: 'Pane', id: 'component:mod-pane', detail: 'svg' }), {
    ops: [{ op: 'add', kind: 'component', label: 'Pane', id: 'component:mod-pane', detail: 'svg' }],
  })
})

test('v2-06: link, resolve and abandon map to one op each', () => {
  assert.deepEqual(toolInputToOps({ action: 'link', from: 'constraint:no-webgl', to: 'decision:svg', kind: 'constrains' }), {
    ops: [{ op: 'link', from: 'constraint:no-webgl', to: 'decision:svg', kind: 'constrains' }],
  })
  assert.deepEqual(toolInputToOps({ action: 'resolve', id: 'question:q', by: 'decision:d', note: 'settled' }), {
    ops: [{ op: 'resolve', id: 'question:q', by: 'decision:d', note: 'settled' }],
  })
  assert.deepEqual(toolInputToOps({ action: 'abandon', id: 'decision:webgl-in-pane', reason: 'no WebGL in panes' }), {
    ops: [{ op: 'abandon', id: 'decision:webgl-in-pane', reason: 'no WebGL in panes' }],
  })
})

test('v2-06: import with inline ops returns the op list', () => {
  const ops = [
    { op: 'add', kind: 'goal', label: 'G' },
    { op: 'link', from: 'component:a', to: 'goal:g', kind: 'depends-on' },
  ]
  assert.deepEqual(toolInputToOps({ action: 'import', ops }), {
    ops: [
      { op: 'add', kind: 'goal', label: 'G' },
      { op: 'link', from: 'component:a', to: 'goal:g', kind: 'depends-on' },
    ],
  })
})

test('v2-06: wrong kind family, missing fields and bad ids return an error naming the field', () => {
  const err = (input: unknown) => {
    const r = toolInputToOps(input)
    assert.ok('error' in r, `expected an error for ${JSON.stringify(input)}`)
    return r.error
  }
  assert.match(err({ action: 'link', from: 'component:a', to: 'goal:g', kind: 'component' }), /kind/)
  assert.match(err({ action: 'add', kind: 'depends-on', label: 'x' }), /kind/)
  assert.match(err({ action: 'add', kind: 'risk' }), /label/)
  assert.match(err({ action: 'link', to: 'goal:g', kind: 'depends-on' }), /from/)
  assert.match(err({ action: 'link', from: 'component:a', kind: 'depends-on' }), /\bto\b/)
  assert.match(err({ action: 'resolve' }), /\bid\b/)
  assert.match(err({ action: 'abandon', id: 'decision:d' }), /reason/)
  assert.match(err({ action: 'abandon', id: 'decision:d', reason: '   ' }), /reason/)
  assert.match(err({ action: 'add', kind: 'risk', label: 'x', id: 'Risk:Bad' }), /\bid\b/)
  assert.match(err({ action: 'resolve', id: 'question:' }), /\bid\b/)
  assert.match(err({ action: 'abandon', id: 'decision:' + 'a'.repeat(49), reason: 'r' }), /\bid\b/)
  assert.match(err({ action: 'import' }), /ops|path/)
  assert.match(err({ action: 'import', ops: [{ op: 'add', kind: 'goal' }] }), /ops\[0\]/)
  assert.match(err(null), /action/)
  assert.match(err({ action: 'inspect' }), /action/)
})

test('v2-06: link targets may be evidence ids for supported-by', () => {
  assert.deepEqual(toolInputToOps({ action: 'link', from: 'decision:d', to: 'file:/repo/a.ts', kind: 'supported-by' }), {
    ops: [{ op: 'link', from: 'decision:d', to: 'file:/repo/a.ts', kind: 'supported-by' }],
  })
})

test('v3-20: TOOL_SCHEMA is exactly v3 design.md 4.9 (supersedes the v2 5.4 schema)', () => {
  // Restated from v3 design.md 4.9 (descriptions included), not derived from the implementation.
  const ID = '^[a-z]+:[a-z0-9-]{1,48}$'
  const expected = {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['inspect', 'focus', 'clear', 'add', 'link', 'resolve', 'abandon', 'import', 'uml.add', 'uml.relate', 'uml.remove', 'uml.scan'],
        description:
          'inspect: solution + UML model, cross-check and what the question touches; focus/clear: steer relevance; add/link/resolve/abandon: author the solution model; uml.add/uml.relate/uml.remove: record the intended UML design, each citing the decision that causes it; uml.scan: rescan the code (optionally set root); import: seed file or inline ops.',
      },
      kind: {
        type: 'string',
        enum: ['goal', 'component', 'requirement', 'constraint', 'assumption', 'dependency', 'risk', 'decision', 'question',
          'depends-on', 'constrains', 'decided-by', 'contradicts', 'supported-by',
          'class', 'interface', 'association', 'realization', 'composition', 'generalization'],
        description: 'add: node kind. link: edge kind. uml.add: component | class | interface. uml.relate / uml.remove (relation): association | dependency | realization | composition | generalization.',
      },
      id: { type: 'string', pattern: ID, description: 'add/resolve/abandon: solution node id. uml.add (optional, default uml:<slug(name)>) / uml.remove: UML element id.' },
      label: { type: 'string', maxLength: 120, description: 'add: short name, cut to 60 chars. uml.relate: edge label, cut to 40.' },
      detail: { type: 'string', maxLength: 280, description: 'add: one or two sentences.' },
      evidence: { type: 'array', items: { type: 'string' }, maxItems: 12, description: 'add/resolve: transcript node ids (prompt:…, turn:…, tool:…, file:…) that support this; inspect lists them.' },
      from: { type: 'string', description: 'link: source solution id. uml.relate / uml.remove (relation): source UML element id.' },
      to: { type: 'string', description: 'link: target solution id, or an evidence id for supported-by. uml.relate / uml.remove (relation): target UML element id.' },
      by: { type: 'string', description: 'resolve: the decision id that settles the question or risk (adds decided-by).' },
      note: { type: 'string', maxLength: 140, description: 'resolve: how it was settled. focus: why these nodes matter. uml.add: tooltip note.' },
      reason: { type: 'string', maxLength: 140, description: 'abandon / uml.remove: why (required).' },
      path: { type: 'string', description: 'import: a seed file (context-graph/solution@1 or @2 JSON), relative to cwd or absolute.' },
      ops: { type: 'array', items: { type: 'object' }, maxItems: 200, description: "import: inline ops (solution and uml.* ops), same shape as a seed file's ops." },
      mode: { type: 'string', enum: ['merge', 'replace'], description: 'import: merge into the current models (default) or replace both.' },
      nodeIds: { type: 'array', items: { type: 'string' }, description: 'focus: solution, UML or transcript node ids.' },
      match: { type: 'string', description: 'focus: text matched against node labels, solution labels, UML names and file paths.' },
      decision: { type: 'string', pattern: '^decision:[a-z0-9-]{1,48}$', description: 'uml.add/uml.relate/uml.remove: the solution decision that causes this change (required; add the decision first).' },
      name: { type: 'string', minLength: 1, maxLength: 60, description: 'uml.add: element name as drawn, e.g. SvgRenderer.' },
      stereotype: { type: 'string', maxLength: 40, description: "uml.add: extra «stereotype», e.g. 'vendored' or 'MCP tool'." },
      attributes: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 24, description: "uml.add: attributes, e.g. 'theme: dark or light'. Merged by name." },
      operations: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 24, description: "uml.add: operations, e.g. '+renderSvg(scene, o) string'. Merged by name." },
      in: { type: 'string', pattern: ID, description: 'uml.add: owning component id (adds a composition).' },
      code: { type: 'string', maxLength: 200, description: "uml.add: where it lives, relative to the scan root: 'core/svg.ts', 'core/svg.ts#SvgOptions', a folder 'core/', '../outside/path', 'npm:pkg', or 'none' (not checkable). Omit to match by name." },
      member: { type: 'string', maxLength: 60, description: 'uml.remove: remove only this attribute/operation (by name) of element id.' },
      root: { type: 'string', description: 'uml.scan: scan root, relative to cwd or absolute; persisted. Default: <cwd>/src if it exists, else <cwd>.' },
    },
  }
  assert.deepEqual(JSON.parse(JSON.stringify(TOOL_SCHEMA)), expected)
  assert.equal(expected.properties.action.enum.length, 12)
  assert.equal(expected.properties.kind.enum.length, 20)
})

const err = (input: unknown): string => {
  const r = toolInputToOps(input)
  assert.ok('error' in r, `expected an error for ${JSON.stringify(input)}`)
  return r.error
}

test('v3-20: the unknown-action error lists all 12 actions', () => {
  const e = err({ action: 'frobnicate' })
  assert.match(e, /^action:/)
  for (const a of ['inspect', 'focus', 'clear', 'add', 'link', 'resolve', 'abandon', 'import', 'uml.add', 'uml.relate', 'uml.remove', 'uml.scan']) assert.ok(e.includes(a), a)
})

test('v3-20: uml.add maps to one uml.add op; missing decision, name or a valid kind names the field', () => {
  assert.deepEqual(
    toolInputToOps({ action: 'uml.add', decision: 'decision:svg-pane', kind: 'class', name: 'SvgRenderer', id: 'uml:svg-renderer', stereotype: 'core', in: 'uml:pane', code: 'core/svg.ts', note: 'n', attributes: ['theme: dark'], operations: ['+render() string'] }),
    { ops: [{ op: 'uml.add', decision: 'decision:svg-pane', kind: 'class', name: 'SvgRenderer', id: 'uml:svg-renderer', stereotype: 'core', in: 'uml:pane', code: 'core/svg.ts', note: 'n', attributes: ['theme: dark'], operations: ['+render() string'] }] },
  )
  assert.deepEqual(toolInputToOps({ action: 'uml.add', decision: 'decision:d', kind: 'component', name: 'Pane' }), {
    ops: [{ op: 'uml.add', decision: 'decision:d', kind: 'component', name: 'Pane' }],
  })
  assert.match(err({ action: 'uml.add', kind: 'class', name: 'X' }), /^decision: required/)
  assert.match(err({ action: 'uml.add', decision: 'goal:g', kind: 'class', name: 'X' }), /^decision:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class' }), /^name:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class', name: '  ' }), /^name:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class', name: 'x'.repeat(61) }), /^name:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'risk', name: 'X' }), /^kind:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', name: 'X' }), /^kind:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class', name: 'X', id: 'Bad' }), /^id:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class', name: 'X', in: 'nope' }), /^in:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class', name: 'X', attributes: 'a' }), /^attributes:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class', name: 'X', operations: [1] }), /^operations:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class', name: 'X', code: 5 }), /^code:/)
  assert.match(err({ action: 'uml.add', decision: 'decision:d', kind: 'class', name: 'X', stereotype: {} }), /^stereotype:/)
})

test('v3-20: uml.relate needs a relation kind, from and to; a solution edge kind is an error', () => {
  assert.deepEqual(toolInputToOps({ action: 'uml.relate', decision: 'decision:d', kind: 'dependency', from: 'uml:a', to: 'uml:b', label: 'uses' }), {
    ops: [{ op: 'uml.relate', decision: 'decision:d', kind: 'dependency', from: 'uml:a', to: 'uml:b', label: 'uses' }],
  })
  assert.match(err({ action: 'uml.relate', decision: 'decision:d', kind: 'depends-on', from: 'uml:a', to: 'uml:b' }), /^kind:/)
  assert.match(err({ action: 'uml.relate', decision: 'decision:d', kind: 'class', from: 'uml:a', to: 'uml:b' }), /^kind:/)
  assert.match(err({ action: 'uml.relate', decision: 'decision:d', kind: 'dependency', to: 'uml:b' }), /^from:/)
  assert.match(err({ action: 'uml.relate', decision: 'decision:d', kind: 'dependency', from: 'uml:a', to: 'B' }), /^to:/)
  assert.match(err({ action: 'uml.relate', kind: 'dependency', from: 'uml:a', to: 'uml:b' }), /^decision:/)
})

test('v3-20: uml.remove needs a reason and exactly one target (id | id+member | from+kind+to)', () => {
  assert.deepEqual(toolInputToOps({ action: 'uml.remove', decision: 'decision:d', reason: 'gone', id: 'uml:a' }), {
    ops: [{ op: 'uml.remove', decision: 'decision:d', reason: 'gone', id: 'uml:a' }],
  })
  assert.deepEqual(toolInputToOps({ action: 'uml.remove', decision: 'decision:d', reason: 'gone', id: 'uml:a', member: 'theme' }), {
    ops: [{ op: 'uml.remove', decision: 'decision:d', reason: 'gone', id: 'uml:a', member: 'theme' }],
  })
  assert.deepEqual(toolInputToOps({ action: 'uml.remove', decision: 'decision:d', reason: 'gone', from: 'uml:a', kind: 'composition', to: 'uml:b' }), {
    ops: [{ op: 'uml.remove', decision: 'decision:d', reason: 'gone', from: 'uml:a', kind: 'composition', to: 'uml:b' }],
  })
  assert.match(err({ action: 'uml.remove', decision: 'decision:d', reason: 'gone' }), /target|id|from/)
  assert.match(err({ action: 'uml.remove', decision: 'decision:d', reason: 'gone', id: 'uml:a', from: 'uml:a', kind: 'dependency', to: 'uml:b' }), /target|exactly one/)
  assert.match(err({ action: 'uml.remove', decision: 'decision:d', reason: 'gone', from: 'uml:a', to: 'uml:b' }), /^kind:/)
  assert.match(err({ action: 'uml.remove', decision: 'decision:d', reason: 'gone', member: 'theme' }), /target|id/)
  assert.match(err({ action: 'uml.remove', decision: 'decision:d', id: 'uml:a' }), /^reason:/)
  assert.match(err({ action: 'uml.remove', decision: 'decision:d', id: 'uml:a', reason: ' ' }), /^reason:/)
  assert.match(err({ action: 'uml.remove', reason: 'r', id: 'uml:a' }), /^decision:/)
  assert.match(err({ action: 'uml.remove', decision: 'decision:d', reason: 'r', id: 'uml:a', cascade: true }), /cascade/)
})

test('v3-20: uml.scan returns no ops and the optional root', () => {
  assert.deepEqual(toolInputToOps({ action: 'uml.scan' }), { ops: [] })
  assert.deepEqual(toolInputToOps({ action: 'uml.scan', root: 'src' }), { ops: [], root: 'src' })
  assert.match(err({ action: 'uml.scan', root: 3 }), /^root:/)
})

test('v3-20: import inline ops accept uml.* ops and reject a malformed one with its index', () => {
  const ops = [
    { op: 'add', kind: 'decision', label: 'D', id: 'decision:d' },
    { op: 'uml.add', decision: 'decision:d', kind: 'component', name: 'Pane' },
    { op: 'uml.relate', decision: 'decision:d', kind: 'dependency', from: 'uml:pane', to: 'uml:svg' },
    { op: 'uml.remove', decision: 'decision:d', reason: 'r', id: 'uml:svg', cascade: true },
  ]
  assert.deepEqual(toolInputToOps({ action: 'import', ops, mode: 'replace' }), { ops, mode: 'replace' })
  assert.match(err({ action: 'import', ops: [ops[0], { op: 'uml.add', decision: 'decision:d', kind: 'risk', name: 'X' }] }), /^ops\[1\]/)
})

test('v3-20: toolInputToOps never throws on garbage input', () => {
  const garbage: unknown[] = [undefined, null, 0, 'x', [], [1], { action: 1 }, { action: 'uml.add', attributes: { length: 3 } },
    { action: 'uml.relate', from: {}, to: [], kind: null, decision: 7 }, { action: 'uml.remove', id: {}, member: [], decision: 'decision:d', reason: 5 },
    { action: 'import', ops: [null, 1, 'a', { op: 'uml.add' }] }, { action: 'uml.scan', root: null }, Object.create(null)]
  for (const g of garbage) assert.doesNotThrow(() => toolInputToOps(g))
})
