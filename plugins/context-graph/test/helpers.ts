// Shared test builders: realistic graphs made through the public ingest reducer.
import { applyEvents, emptyGraph } from '../src/core/ingest.ts'
import type { Graph, GraphEvent } from '../src/core/types.ts'

/** `prompts` prompts, each followed by one turn with `toolsPerPrompt` Read tools over a pool of `files` paths. */
export function synthGraph(prompts: number, toolsPerPrompt: number, files = 20, maxNodes = 1000): Graph {
  const evs: GraphEvent[] = []
  let t = 0
  for (let p = 0; p < prompts; p++) {
    evs.push({ kind: 'prompt', id: `p${p}`, text: `question ${p}` })
    evs.push({ kind: 'assistant', messageId: `m${p}`, text: `answer ${p}`.repeat(10), usage: { output_tokens: 50 } })
    for (let k = 0; k < toolsPerPrompt; k++, t++) {
      evs.push({ kind: 'tool_use', id: `u${t}`, messageId: `m${p}`, name: 'Read', input: { file_path: `/repo/f${t % files}.ts` } })
      evs.push({ kind: 'tool_result', toolUseId: `u${t}`, chars: 400 + (t % 7) * 300, isError: false })
    }
  }
  return applyEvents(emptyGraph(), evs, { maxNodes })
}
