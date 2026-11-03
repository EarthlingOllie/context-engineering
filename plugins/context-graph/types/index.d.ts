// $.state contract for the context-graph mod (design.md section 5). Self-contained, as the engine requires:
// these mirror src/core/types.ts (Graph, Focus, Vec3, View) and src/core/live.ts (AppendCursor).
export type ContextGraphNodeKind = 'system' | 'prompt' | 'turn' | 'tool' | 'file' | 'compaction'
export type ContextGraphNode = {
  id: string
  kind: ContextGraphNodeKind
  label: string
  tokens: number
  seq: number
  inWindow: boolean
  meta?: { tool?: string; path?: string; isError?: boolean; note?: string; outputTokens?: number; windowTokens?: number }
}
export type ContextGraphEdge = { from: string; to: string; kind: 'prompt-turn' | 'turn-turn' | 'turn-tool' | 'tool-file' | 'compact-covers' }
export type ContextGraph = {
  nodes: Record<string, ContextGraphNode>
  edges: ContextGraphEdge[]
  latestPromptId: string | null
  latestTurnId: string | null
  promptTurnId: string | null
  seq: number
  meta: { skipped: number }
}
export type ContextGraphVec3 = { x: number; y: number; z: number }
export type ContextGraphFocus = { seeds: { id: string; source: 'prompt' | 'model' }[]; note?: string; question?: string; updatedAt?: number }
export type ContextGraphLayers = 'both' | 'solution' | 'evidence'
export type ContextGraphView = { yaw: number; pitch: number; distance: number; fov: number; zoom: number; autoOrbit: boolean; layers: ContextGraphLayers }
/** pos-2: the solution layer over the evidence (transcript) layer */
export type ContextGraphPositions = { solution: Record<string, ContextGraphVec3>; evidence: Record<string, ContextGraphVec3> }
// Mirrors src/core/solution-types.ts (SolutionModel).
export type ContextGraphSolKind = 'goal' | 'component' | 'requirement' | 'constraint' | 'assumption' | 'dependency' | 'risk' | 'decision' | 'question'
export type ContextGraphSolNode = {
  id: string
  kind: ContextGraphSolKind
  label: string
  detail?: string
  status: 'active' | 'open' | 'resolved' | 'abandoned'
  createdSeq: number
  updatedSeq: number
  reason?: string
}
export type ContextGraphSolEdge = { from: string; to: string; kind: 'depends-on' | 'constrains' | 'decided-by' | 'contradicts' | 'supported-by'; seq: number }
export type ContextGraphSolution = {
  version: 1
  goalId: string | null
  nodes: Record<string, ContextGraphSolNode>
  edges: ContextGraphSolEdge[]
  seq: number
  promptSeq: number
  title?: string
}
/** export-1: where turn.complete writes the Artifact page; path '' means <cwd>/.context-graph/solution.html */
export type ContextGraphExportState = { path: string; document: boolean; lastKey: string | null; lastWrittenAt: number | null; lastError?: string }
export type ContextGraphCursor = { turn: string | null }

declare module 'claude-code' {
  interface PluginState {
    'context-graph': {
      graph: Shaped<ContextGraph>
      positions: Shaped<ContextGraphPositions>
      solution: Shaped<ContextGraphSolution>
      exportState: Shaped<ContextGraphExportState>
      focus: Shaped<ContextGraphFocus>
      view: Shaped<ContextGraphView>
      cursor: Shaped<ContextGraphCursor>
    }
  }
}
