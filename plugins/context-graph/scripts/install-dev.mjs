// Install the mod into this Claude Code session's dev-mods folder: ~/.claude/dev-mods/<session>/context-graph.
// The session id comes from CLAUDE_SESSION_ID or the first argument. Only runtime files are copied (see stage.mjs).
import { homedir } from 'node:os'
import { join } from 'node:path'
import { stage } from './stage.mjs'

const session = process.argv[2] ?? process.env.CLAUDE_SESSION_ID ?? process.env.CLAUDE_CODE_SESSION_ID
if (!session || !/^[A-Za-z0-9-]+$/.test(session)) {
  console.error('usage: npm run install-dev -- <session-id>   (or set CLAUDE_SESSION_ID)')
  process.exit(2)
}
console.log('installed to ' + stage(join(homedir(), '.claude', 'dev-mods', session, 'context-graph')))
