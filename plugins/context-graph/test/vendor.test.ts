// Feature 10 (vendor half): vendored three.js math is a static, local, eval-free ES module.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import * as THREE from '../vendor/three-math/index.js'

const dir = fileURLToPath(new URL('../vendor/three-math/', import.meta.url))

test('vendored three math exports Vector3 and Matrix4 that do real math', () => {
  const m = new THREE.Matrix4().makeTranslation(1, 2, 3)
  const v = new THREE.Vector3(1, 1, 1).applyMatrix4(m)
  assert.deepEqual([v.x, v.y, v.z], [2, 3, 4])
})

test('vendored files contain no dynamic import, eval or remote import', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'))
  assert.ok(files.length >= 6)
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8')
    assert.ok(!src.includes('import('), `${f} has import(`)
    assert.ok(!src.includes('new Function'), `${f} has new Function`)
    assert.ok(!/\beval\(/.test(src), `${f} has eval(`)
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) assert.match(m[1]!, /^\.\/[A-Za-z0-9]+\.js$/, `${f} imports ${m[1]}`)
  }
})

test('licence and version are recorded', () => {
  assert.match(readFileSync(join(dir, 'VERSION'), 'utf8'), /three@0\.170\.0/)
  assert.match(readFileSync(join(dir, 'LICENSE'), 'utf8'), /MIT/)
})
