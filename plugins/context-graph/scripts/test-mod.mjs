// Run `claude plugin test` on a staged copy of the mod (hooks/*.test.tsx only; node:test suites stay behind).
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stage } from './stage.mjs'

const dir = stage(join(mkdtempSync(join(tmpdir(), 'context-graph-')), 'context-graph'), { withTests: true })
const r = spawnSync(process.env.CLAUDE_BIN ?? 'claude', ['plugin', 'test', dir], { stdio: 'inherit' })
rmSync(join(dir, '..'), { recursive: true, force: true })
process.exit(r.status ?? 1)
