// Solution layer domain model (v2 design.md section 3). Pure types only.

export type FactorKind = 'requirement' | 'constraint' | 'assumption' | 'dependency' | 'risk'
export type SolKind = 'goal' | 'component' | FactorKind | 'decision' | 'question'
/** question/risk: born 'open' -> 'resolved'; every kind but goal -> 'abandoned'; all others born 'active'. */
export type SolStatus = 'active' | 'open' | 'resolved' | 'abandoned'
export type SolEdgeKind = 'depends-on' | 'constrains' | 'decided-by' | 'contradicts' | 'supported-by'

export const SOL_KINDS: readonly SolKind[] = ['goal', 'component', 'requirement', 'constraint', 'assumption', 'dependency', 'risk', 'decision', 'question']
export const FACTOR_KINDS: readonly FactorKind[] = ['requirement', 'constraint', 'assumption', 'dependency', 'risk']
export const SOL_EDGE_KINDS: readonly SolEdgeKind[] = ['depends-on', 'constrains', 'decided-by', 'contradicts', 'supported-by']

export interface SolNode {
  /** `${kind}:${slug}`, slug = [a-z0-9-]{1,48} */
  id: string
  kind: SolKind
  /** 1..60 chars after trim (longer is cut with "…") */
  label: string
  detail?: string
  status: SolStatus
  createdSeq: number
  updatedSeq: number
  /** abandon reason or resolve note, <= 140 chars */
  reason?: string
}

export interface SolEdge {
  from: string
  /** a solution id, or (supported-by only) an evidence id from the transcript Graph */
  to: string
  kind: SolEdgeKind
  seq: number
}

export interface SolutionModel {
  version: 1
  goalId: string | null
  nodes: Record<string, SolNode>
  /** unique on (from,to,kind); contradicts stored with from < to */
  edges: SolEdge[]
  /** bumps once per applied op */
  seq: number
  /** model.seq when the current prompt began -> "new this prompt" */
  promptSeq: number
  title?: string
}

export type SolOp =
  | { op: 'add'; kind: SolKind; label: string; id?: string; detail?: string; evidence?: string[] }
  | { op: 'link'; from: string; to: string; kind: SolEdgeKind }
  | { op: 'resolve'; id: string; by?: string; note?: string; evidence?: string[] }
  | { op: 'abandon'; id: string; reason: string }

export interface OpResult {
  i: number
  op: SolOp['op']
  ok: boolean
  id?: string
  error?: string
  warnings?: string[]
}
