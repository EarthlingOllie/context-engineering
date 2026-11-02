// Lay the engine's API declarations where tsconfig.mod.json reads them (.claude-plugin/types/claude-code/index.d.ts),
// as the engine itself does when it loads the mod. Source: CLAUDE_CODE_TYPES or the first argument
// (the plugin-authoring skill's types/claude-code.d.ts).
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = process.argv[2] ?? process.env.CLAUDE_CODE_TYPES
if (!src) { console.error('usage: npm run types -- <path to claude-code.d.ts>'); process.exit(2) }
const dest = join(dirname(fileURLToPath(import.meta.url)), '..', '.claude-plugin', 'types', 'claude-code', 'index.d.ts')
mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log(dest)
