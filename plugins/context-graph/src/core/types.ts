// Domain model for the context graph (design.md section 3). Pure types only.

export type NodeKind = 'system' | 'prompt' | 'turn' | 'tool' | 'file' | 'compaction'

export interface NodeMeta {
  tool?: string
  path?: string
  isError?: boolean
  note?: string
  outputTokens?: number
  windowTokens?: number
}

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  tokens: number
  seq: number
  inWindow: boolean
  meta?: NodeMeta
}

export type EdgeKind = 'prompt-turn' | 'turn-turn' | 'turn-tool' | 'tool-file' | 'compact-covers'

export interface GraphEdge {
  from: string
  to: string
  kind: EdgeKind
}

export interface Graph {
  nodes: Record<string, GraphNode>
  edges: GraphEdge[]
  latestPromptId: string | null
  /** id of the latest turn node, used for prompt->turn / turn->turn edges */
  latestTurnId: string | null
  /** turn id that the latest prompt has linked to, null until its first turn */
  promptTurnId: string | null
  seq: number
  meta: { skipped: number }
}

export interface Usage {
  input_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  output_tokens?: number
}

export type GraphEvent =
  | { kind: 'prompt'; id: string; text: string }
  | { kind: 'injected'; chars: number }
  | { kind: 'attachment'; chars: number }
  | { kind: 'assistant'; messageId: string; text: string; usage?: Usage }
  | { kind: 'tool_use'; id: string; messageId: string; name: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; chars: number; isError: boolean }
  | { kind: 'context'; categories: { name: string; tokens: number }[] }
  | { kind: 'compact'; id: string; summaryChars: number; preTokens?: number }

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type SeedSource = 'prompt' | 'model'

export interface Seed {
  id: string
  source: SeedSource
}

export interface BlastRadius {
  weights: Record<string, number>
  hops: Record<string, number>
  seeds: string[]
  tokens: number
  centroidIds: string[]
}

export interface View {
  yaw: number
  pitch: number
  distance: number
  fov: number
}

export interface Focus {
  seeds: Seed[]
  note?: string
  question?: string
  updatedAt?: number
}

// v2 solution layer
export * from './solution-types.ts'
export * from './uml-types.ts'
