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
export type ContextGraphView = { yaw: number; pitch: number; distance: number; fov: number; zoom: number; autoOrbit: boolean }
export type ContextGraphCursor = { turn: string | null }

declare module 'claude-code' {
  interface PluginState {
    'context-graph': {
      graph: Shaped<ContextGraph>
      positions: Shaped<Record<string, ContextGraphVec3>>
      focus: Shaped<ContextGraphFocus>
      view: Shaped<ContextGraphView>
      cursor: Shaped<ContextGraphCursor>
    }
  }
}
