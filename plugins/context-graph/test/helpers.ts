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

// v2: the small solution fixture over a synthetic transcript, run through the pure pipeline.
import { readFileSync } from 'node:fs'
import { applyOps, emptyModel, parseSeed } from '../src/core/solution.ts'
import { blastRadius } from '../src/core/blast.ts'
import { relevance } from '../src/core/relevance.ts'
import { health } from '../src/core/health.ts'
import { layoutLayers } from '../src/core/layers.ts'
import { buildLayeredScene } from '../src/core/scene.ts'
import type { Scene } from '../src/core/scene.ts'
import type { SolutionModel } from '../src/core/types.ts'

export const LAYERED_VIEW = { yaw: 20, pitch: 35, distance: 0, fov: 50 }

/** The pure-pipeline inputs for solution-small.json over synthGraph(4, 5); promptSeq 12. */
export function layeredInputs() {
  const graph = synthGraph(4, 5)
  const seed = parseSeed(readFileSync(new URL('./fixtures/solution-small.json', import.meta.url), 'utf8'))
  const model = { ...applyOps(emptyModel(), seed.ops, { isEvidence: (id) => Boolean(graph.nodes[id]) }).model, promptSeq: 12 }
  const focus = { seeds: [{ id: 'question:do-panes-work-on-the-web', source: 'model' as const }] }
  const blast = blastRadius(graph, [{ id: 'prompt:p2', source: 'prompt' }])
  const rel = relevance(model, graph, focus, blast)
  const positions = layoutLayers(model, graph, { solution: {}, evidence: {} }, { seed: 1 })
  return { model, graph, positions, relevance: rel, health: health(model, graph), blast }
}

/** solution-small.json over synthGraph(4, 5); promptSeq 12, so the two questions (adds 13 and 14) are new. */
export function layeredFixture(layers: 'both' | 'solution' | 'evidence' = 'both', size = { w: 800, h: 600 }): { scene: Scene; model: SolutionModel; graph: Graph } {
  const { model, graph, positions, relevance: rel, health: hl } = layeredInputs()
  const scene = buildLayeredScene({ model, graph, positions, relevance: rel, health: hl, view: LAYERED_VIEW, layers }, size)
  return { scene, model, graph }
}

/**
 * Best (minimum) wall time of `runs` calls after `warm` untimed ones. Timing budgets assert on the best run: the
 * algorithm's cost, not scheduler noise from the other test files running in parallel (a median flaked under load).
 */
export function bestMs(fn: () => void, runs = 7, warm = 2): number {
  for (let k = 0; k < warm; k++) fn()
  let best = Infinity
  for (let k = 0; k < runs; k++) { const t = performance.now(); fn(); best = Math.min(best, performance.now() - t) }
  return best
}
