// Feature 25: install-dev (and test:mod) stage only the runtime folders the engine loads.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error plain .mjs script without types
import { stage } from '../scripts/stage.mjs'

test('install-dev copies only .claude-plugin, hooks, src, types and vendor, without tests or engine types', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cg-stage-'))
  try {
    const dest = stage(join(dir, 'context-graph')) as string
    assert.deepEqual(readdirSync(dest).sort(), ['.claude-plugin', 'hooks', 'src', 'types', 'vendor'])
    assert.deepEqual(readdirSync(join(dest, 'hooks')).sort(), ['hooks.json', 'register.tsx'])
    assert.equal(existsSync(join(dest, '.claude-plugin', 'types')), false)
    assert.equal(existsSync(join(dest, 'vendor', 'three-math', 'index.js')), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the test:mod stage keeps hooks/*.test.tsx', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cg-stage-'))
  try {
    const dest = stage(join(dir, 'context-graph'), { withTests: true }) as string
    assert.ok(readdirSync(join(dest, 'hooks')).includes('register.test.tsx'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// v3-27: src/core stays pure, including the v3 modules (uml, timeline, codeScan, crossCheck, diagram, mermaid, umlPane).
test('src/core/** imports no claude-code and uses no Date.now, Math.random, fetch or fs', () => {
  const core = new URL('../src/core/', import.meta.url).pathname
  const files = readdirSync(core).filter((f) => f.endsWith('.ts'))
  for (const v3 of ['uml-types.ts', 'uml.ts', 'timeline.ts', 'codeScan.ts', 'crossCheck.ts', 'diagram.ts', 'mermaid.ts', 'umlPane.ts']) assert.ok(files.includes(v3), v3)
  for (const f of files) {
    const text = readFileSync(join(core, f), 'utf8')
    assert.doesNotMatch(text, /from ['"]claude-code/, `${f} imports claude-code`)
    assert.doesNotMatch(text, /\bDate\.now\(|\bMath\.random\(|\bfetch\(/, `${f} uses the clock, randomness or the network`)
    assert.doesNotMatch(text, /from ['"](node:)?fs(\/promises)?['"]|require\(['"](node:)?fs/, `${f} reads the file system`)
  }
})

test('package.json adds no runtime dependency and both manifests are at 0.3.0', () => {
  const root = new URL('../', import.meta.url).pathname
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string; dependencies?: object }
  const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8')) as { version: string }
  assert.equal(pkg.dependencies, undefined)
  assert.equal(pkg.version, '0.3.0')
  assert.equal(plugin.version, '0.3.0')
})
