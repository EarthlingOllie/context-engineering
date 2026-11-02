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

test('v2-06: TOOL_SCHEMA is exactly design.md 5.4', () => {
  // Restated from design.md 5.4 (descriptions included), not derived from the implementation.
  const expected = {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['inspect', 'focus', 'clear', 'add', 'link', 'resolve', 'abandon', 'import'],
        description:
          'inspect: solution model + what the current question touches; focus/clear: steer relevance; add/link/resolve/abandon: author the solution model; import: load a seed file or inline ops.',
      },
      kind: {
        type: 'string',
        enum: ['goal', 'component', 'requirement', 'constraint', 'assumption', 'dependency', 'risk', 'decision', 'question', 'depends-on', 'constrains', 'decided-by', 'contradicts', 'supported-by'],
        description: 'add: node kind. link: edge kind.',
      },
      id: { type: 'string', pattern: '^[a-z]+:[a-z0-9-]{1,48}$', description: 'add (optional, default kind:slug(label)) / resolve / abandon: solution node id.' },
      label: { type: 'string', maxLength: 120, description: 'add: short name, cut to 60 chars.' },
      detail: { type: 'string', maxLength: 280, description: 'add: one or two sentences.' },
      evidence: { type: 'array', items: { type: 'string' }, maxItems: 12, description: 'add/resolve: transcript node ids (prompt:…, turn:…, tool:…, file:…) that support this; inspect lists them.' },
      from: { type: 'string', description: 'link: source solution id.' },
      to: { type: 'string', description: 'link: target solution id, or an evidence id for supported-by.' },
      by: { type: 'string', description: 'resolve: the decision id that settles the question or risk (adds decided-by).' },
      note: { type: 'string', maxLength: 140, description: 'resolve: how it was settled. focus: why these nodes matter (shown in the pane).' },
      reason: { type: 'string', maxLength: 140, description: 'abandon: why the approach was dropped (required).' },
      path: { type: 'string', description: 'import: a seed file (context-graph/solution@1 JSON), relative to cwd or absolute.' },
      ops: { type: 'array', items: { type: 'object' }, maxItems: 200, description: "import: inline SolOp list, same shape as a seed file's ops." },
      mode: { type: 'string', enum: ['merge', 'replace'], description: 'import: merge into the current model (default) or replace it.' },
      nodeIds: { type: 'array', items: { type: 'string' }, description: 'focus: solution or transcript node ids.' },
      match: { type: 'string', description: 'focus: text matched against node labels, solution labels and file paths.' },
    },
  }
  assert.deepEqual(JSON.parse(JSON.stringify(TOOL_SCHEMA)), expected)
  assert.equal(expected.properties.action.enum.length, 8)
})
