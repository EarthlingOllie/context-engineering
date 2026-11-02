// Copy the mod's runtime files (what the engine loads) to <dest>: .claude-plugin (minus types/), hooks, src, types,
// vendor, LICENSE. Used by install-dev (dest = ~/.claude/dev-mods/<session>/context-graph) and test:mod (a temp dir,
// so `claude plugin test` sees only hooks/*.test.tsx and not the node:test suites under test/).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MOD_FILES = ['.claude-plugin', 'hooks', 'src', 'types', 'vendor', 'LICENSE', 'README.md']

export function stage(dest, { withTests = false } = {}) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  for (const f of MOD_FILES) {
    const from = join(root, f)
    if (!existsSync(from)) continue
    cpSync(from, join(dest, f), {
      recursive: true,
      filter: (src) => !src.includes(`${join(root, '.claude-plugin', 'types')}`) && (withTests || !/\.test\.tsx?$/.test(src)),
    })
  }
  return dest
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dest = process.argv[2]
  if (!dest) { console.error('usage: node scripts/stage.mjs <dest> [--with-tests]'); process.exit(2) }
  console.log(stage(resolve(dest), { withTests: process.argv.includes('--with-tests') }))
}
