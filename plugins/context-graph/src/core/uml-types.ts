// UML design layer domain model (v3 design.md section 3). Pure types only.
import type { OpResult, SolOp, SolutionModel } from './solution-types.ts'

export type UmlKind = 'component' | 'class' | 'interface'
export type UmlRelKind = 'association' | 'dependency' | 'realization' | 'composition' | 'generalization'
export type UmlChange = 'added' | 'changed' | 'removed'

export const UML_KINDS: readonly UmlKind[] = ['component', 'class', 'interface']
export const UML_REL_KINDS: readonly UmlRelKind[] = ['association', 'dependency', 'realization', 'composition', 'generalization']

export interface UmlMember {
  /** identifier: first [A-Za-z_$][\w$]* after an optional visibility char (+ - # ~) */
  name: string
  /** as drawn, <= 80 chars, e.g. "+renderSvg(scene, o) string" */
  text: string
  kind: 'attribute' | 'operation'
  status: 'active' | 'removed'
  /** the decision that last touched it */
  decision: string
}

export interface UmlElement {
  /** "uml:<slug>", slug [a-z0-9-]{1,48} */
  id: string
  kind: UmlKind
  /** 1..60 chars after trim, as drawn */
  name: string
  stereotype?: string
  /** owning component id, from uml.add `in` (also stored as a composition relation) */
  owner?: string
  /** code ref: "core/svg.ts", "core/svg.ts#SvgOptions", "core/", "../vendor/x", "npm:pkg", "none" */
  code?: string
  note?: string
  /** insertion order; unique on (kind, name) */
  members: UmlMember[]
  status: 'active' | 'removed'
  reason?: string
  /** every decision that touched it, first = introducing, unique, in order */
  decisions: string[]
  createdSeq: number
  updatedSeq: number
}

export interface UmlRelation {
  /** `${from}|${kind}|${to}` */
  id: string
  from: string
  to: string
  kind: UmlRelKind
  label?: string
  status: 'active' | 'removed'
  reason?: string
  decisions: string[]
  createdSeq: number
  updatedSeq: number
}

export type UmlOp =
  | {
      op: 'uml.add'; decision: string; kind: UmlKind; name: string; id?: string; stereotype?: string; in?: string
      code?: string; note?: string; attributes?: string[]; operations?: string[]
    }
  | { op: 'uml.relate'; decision: string; kind: UmlRelKind; from: string; to: string; label?: string }
  | {
      op: 'uml.remove'; decision: string; reason: string; id?: string; member?: string
      from?: string; to?: string; kind?: UmlRelKind
      /** set only on replayed abandon-cascade entries (seed @2); not a tool field */
      cascade?: true
    }

export interface UmlLogEntry {
  /** uml.seq after this entry */
  seq: number
  /** solution model seq when applied */
  solSeq: number
  decision: string
  /** the normalised op as applied (replayable) */
  op: UmlOp
  /** element id, relation id, or `${elementId}.${memberName}` */
  target: string
  change: UmlChange
  /** produced by abandoning `decision` */
  cascade?: true
}

export interface UmlModel {
  version: 1
  elements: Record<string, UmlElement>
  relations: Record<string, UmlRelation>
  /** every successful UML change, in order; the timeline is derived from it */
  log: UmlLogEntry[]
  seq: number
}

export type DesignOp = SolOp | UmlOp

export interface DesignState {
  sol: SolutionModel
  uml: UmlModel
}

export interface DesignOpResult extends Omit<OpResult, 'op'> {
  op: DesignOp['op'] | 'uml.cascade'
  change?: UmlChange
  cascaded?: string[]
}
