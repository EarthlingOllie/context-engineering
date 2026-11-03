// $.state contract for the context-graph mod (design.md section 5). Self-contained, as the engine requires:
// these mirror src/core/types.ts (Graph, Focus, Vec3, View), src/core/live.ts (AppendCursor), and for v3
// src/core/uml-types.ts (UmlModel), src/core/codeScan.ts (ScannedFile) and the pane's UML view.
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
// Mirrors src/core/uml-types.ts (UmlModel), v3.
export type ContextGraphUmlKind = 'component' | 'class' | 'interface'
export type ContextGraphUmlRelKind = 'association' | 'dependency' | 'realization' | 'composition' | 'generalization'
export type ContextGraphUmlChange = 'added' | 'changed' | 'removed'
export type ContextGraphUmlMember = { name: string; text: string; kind: 'attribute' | 'operation'; status: 'active' | 'removed'; decision: string }
export type ContextGraphUmlElement = {
  id: string
  kind: ContextGraphUmlKind
  name: string
  stereotype?: string
  owner?: string
  code?: string
  note?: string
  members: ContextGraphUmlMember[]
  status: 'active' | 'removed'
  reason?: string
  decisions: string[]
  createdSeq: number
  updatedSeq: number
}
export type ContextGraphUmlRelation = {
  id: string
  from: string
  to: string
  kind: ContextGraphUmlRelKind
  label?: string
  status: 'active' | 'removed'
  reason?: string
  decisions: string[]
  createdSeq: number
  updatedSeq: number
}
export type ContextGraphUmlOp =
  | { op: 'uml.add'; decision: string; kind: ContextGraphUmlKind; name: string; id?: string; stereotype?: string; in?: string; code?: string; note?: string; attributes?: string[]; operations?: string[] }
  | { op: 'uml.relate'; decision: string; kind: ContextGraphUmlRelKind; from: string; to: string; label?: string }
  | { op: 'uml.remove'; decision: string; reason: string; id?: string; member?: string; from?: string; to?: string; kind?: ContextGraphUmlRelKind; cascade?: true }
export type ContextGraphUmlLogEntry = { seq: number; solSeq: number; decision: string; op: ContextGraphUmlOp; target: string; change: ContextGraphUmlChange; cascade?: true }
/** uml-1: the intended design, recorded decision by decision */
export type ContextGraphUml = {
  version: 1
  elements: Record<string, ContextGraphUmlElement>
  relations: Record<string, ContextGraphUmlRelation>
  log: ContextGraphUmlLogEntry[]
  seq: number
}
// Mirrors src/core/codeScan.ts (ScannedFile / FileScan).
export type ContextGraphScanMember = { name: string; text: string; kind: 'attribute' | 'operation'; visibility: '+' | '-' | '#' }
export type ContextGraphScanType = {
  name: string
  kind: 'class' | 'interface'
  exported: boolean
  stereotype?: 'abstract' | 'type' | 'enum'
  extends: string[]
  implements: string[]
  attributes: ContextGraphScanMember[]
  operations: ContextGraphScanMember[]
  line: number
}
export type ContextGraphFileScan = {
  path: string
  imports: { spec: string; typeOnly: boolean; reexport: boolean; line: number }[]
  functions: ContextGraphScanMember[]
  consts: ContextGraphScanMember[]
  types: ContextGraphScanType[]
  errors: string[]
}
/** scan-1: the code scan under root ('' = auto: <cwd>/src when it exists, else <cwd>); key hashes path:mtime:size */
export type ContextGraphScan = {
  root: string
  files: Record<string, { mtimeMs: number; size: number; scan: ContextGraphFileScan }>
  scannedAt: number | null
  truncated: boolean
  error?: string
  key: string
}
/** umlview-1: the pane's UML view; step null = latest */
export type ContextGraphUmlView = { mode: 'uml' | 'graph'; step: number | null; unplanned: 'components' | 'all' | 'none' }

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
      uml: Shaped<ContextGraphUml>
      scan: Shaped<ContextGraphScan>
      umlView: Shaped<ContextGraphUmlView>
    }
  }
}
