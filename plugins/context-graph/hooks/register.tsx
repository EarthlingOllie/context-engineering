// context-graph mod shell (design.md section 5). Adapter only: all logic lives in src/core.
// Session 1 placeholder: the hooks are wired in a later increment.
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => next(e))
}
