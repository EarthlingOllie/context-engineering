// Feature 25: install-dev (and test:mod) stage only the runtime folders the engine loads.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
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
