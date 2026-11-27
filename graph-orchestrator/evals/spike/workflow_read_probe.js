export const meta = {
  name: 'workflow-read-probe',
  description: 'B-02 spike: record what a Workflow script can read from agent() returns and the runtime',
  phases: [{ title: 'Probe', detail: 'clock globals, budget, two agent calls' }],
}
// Run once in a live cloud session: Workflow({scriptPath: "<this file>"}).
// Paste the returned JSON and the run's journal.jsonl line for each agent into
// docs/specs/observability-evals/tickets/02-spike-what-a-workflow-script-can-read.md.

const tryRead = (name, fn) => {
  try {
    const v = fn()
    return { name, readable: true, value: String(v) }
  } catch (e) {
    return { name, readable: false, error: String(e && e.message ? e.message : e) }
  }
}

phase('Probe')
const clock = [
  tryRead('Date.now()', () => Date.now()),
  tryRead('new Date()', () => new Date().toISOString()),
  tryRead('new Date(0)', () => new Date(0).toISOString()),
  tryRead('performance.now()', () => performance.now()),
  tryRead('process.hrtime', () => process.hrtime()),
  tryRead('setTimeout', () => typeof setTimeout),
]
const globals = tryRead('globals', () => Object.getOwnPropertyNames(globalThis).sort().join(','))
const budgetIn = tryRead('budget', () => JSON.stringify({ total: budget.total, spent: budget.spent() }))

const describe = (r) => ({
  type: r === null ? 'null' : typeof r,
  keys: r && typeof r === 'object' ? Object.getOwnPropertyNames(r) : [],
  proto: r && typeof r === 'object' ? String(Object.getPrototypeOf(r) && Object.getPrototypeOf(r).constructor && Object.getPrototypeOf(r).constructor.name) : '',
  symbols: r && typeof r === 'object' ? Object.getOwnPropertySymbols(r).map(String) : [],
})

const spent0 = tryRead('spent0', () => budget.spent())
const plain = await agent('Reply with the single word: ok', { label: 'probe-plain', effort: 'low' })
const spent1 = tryRead('spent1', () => budget.spent())
const structured = await agent(
  'Run `date -u +%Y-%m-%dT%H:%M:%SZ` in a shell and return its output as `utc`, and your exact model id as `model`.',
  {
    label: 'probe-structured',
    effort: 'low',
    schema: { type: 'object', properties: { utc: { type: 'string' }, model: { type: 'string' } }, required: ['utc', 'model'] },
  },
)
const spent2 = tryRead('spent2', () => budget.spent())

return {
  clock,
  globals,
  budgetIn,
  spent: [spent0, spent1, spent2],
  plain: { value: plain, ...describe(plain) },
  structured: { value: structured, ...describe(structured) },
}
