/**
 * The signature every topology accepts from and returns to the orchestrator.
 * These are the types the planning prompt targets and the Workflow consumes.
 * Vocabulary: CONTEXT.md.
 */

export const TOPOLOGIES = ["single", "generator-evaluator", "fan-out", "debate", "chain", "relay", "best-of-n", "iterative-fan-out", "panel"] as const;
export type Topology = (typeof TOPOLOGIES)[number];

/** A role slot filled at dispatch time: the skill supplies the domain, the instructions the task. */
export type RoleEntry = { skill?: string; instructions: string };

export type ReturnContract = { shape: string; maxLines: number }; // maxLines ≤ 20

export type DispatchSpec = {
  id: string; // "w3-d2"
  title?: string; // what the dispatch is for, in a few words; the workflow's name and the diagram node's first line
  topology: Topology;
  task: string; // one imperative sentence
  context: string[]; // KNOWN lines the worker cannot derive
  roles: Record<string, RoleEntry>;
  params: Record<string, unknown>; // narrowed per topology, see below
  returns: ReturnContract;
  dependsOn: string[];
};

/** Narrowed params. Validated at runtime because the orchestrator writes them as JSON. */
export type SingleParams = Record<string, never>;
export type GeneratorEvaluatorParams = { max_iterations?: number; pass_criteria: string };
export type FanOutParams = {
  width?: number; // ≤ 9
  reducer?: boolean | RoleEntry; // or roles.reducer
  split: string[] | string; // explicit sub-tasks, or a partition instruction
};
export type DebateParams = {
  participants: { name: string; stance: string }[]; // ≤ 6
  rounds?: number; // default 2, ≤ 4
  judge?: RoleEntry; // or roles.judge (required one way or the other)
};
export type ChainParams = { stages: DispatchSpec[] };
export type RelayParams = {
  done_criteria: string; // required: the evaluator done-check is the only stop
  progress: string; // required: the progress-artifact path
  max_sessions?: number; // default 3, ≤ 10
  check_every?: number; // default 1; the last session is always checked
};
export type BestOfNParams = {
  n?: number; // default 3, 2..9; set by variants.length when variants are given
  variants?: string[]; // optional approach hints, one per attempt
  criteria: string; // required
  mode?: "select" | "vote"; // default "select"
};
export type IterativeFanOutParams = {
  split: string[] | string; // explicit sub-tasks, or a partition instruction
  width?: number; // ≤ 9 per round
  coverage_criteria: string; // required
  max_rounds?: number; // default 2, ≤ 3
};
export type PanelLens = { name: string; focus: string; skill?: string };
export type PanelParams = {
  lenses: PanelLens[]; // 1..6, unique names
  pass_criteria: string; // required
  pool?: "all" | "majority"; // default "all"
  reducer?: boolean | RoleEntry; // or roles.reducer
};

/**
 * `failed` is not part of the orchestrator-facing signature; it is what the
 * wave returns instead of throwing when a spec cannot run at all (unknown
 * topology, malformed params, an agent that returned nothing).
 */
export type DispatchStatus = "done" | "blocked" | "exhausted" | "over_budget" | "failed";

export type DispatchResult = {
  id: string;
  status: DispatchStatus;
  result: string; // ≤ maxLines, always inline
  artifacts: string[];
  question?: string; // when blocked; for fan-out, also when a branch blocked
  iterations: number;
  stages?: string[]; // chain only: "w3-s1:done"
};

/** A human intervention, written by the orchestrator (via the next wave or the renderer). */
export type HumanEvent = {
  type: "human";
  at?: string;
  trigger: "ambiguity" | "blocked" | "exhausted" | "irreversible" | "budget";
  dispatch?: string; // the dispatch that raised it, if any
  question: string;
  answer: string;
  mode?: "attended" | "autonomous";
};

/** The args of one dispatch workflow run. */
export type DispatchArgs = {
  now: string; // ISO timestamp supplied by the orchestrator; scripts cannot read the clock
  scratch: string; // the session scratch directory: artifacts go here, the trace line to <scratch>/trace/<id>.jsonl
  dispatch: DispatchSpec;
  humans?: HumanEvent[]; // interventions since the last wave, written by the scribe before the dispatch line
};

export type TraceEvent =
  | { type: "wave_start"; wave: number; at: string; dispatches: number; demand: number; cap: number } // v0.2 traces only
  | {
      type: "dispatch";
      wave: number;
      id: string;
      title?: string;
      at?: string;
      topology: string;
      iterations: number;
      status: DispatchStatus;
      dependsOn: string[];
      stages?: string[];
      parent?: string; // for chain stages
      question?: string;
    }
  | { type: "wave_end"; wave: number; at: string; done: number; blocked: number; exhausted: number; over_budget: number; failed: number } // v0.2 traces only
  | HumanEvent;

/** What a dispatch workflow returns: the result, and whether its trace lines were written. */
export type DispatchReturn = DispatchResult & {
  title?: string;
  scribe: { appended: number; totalLines: number } | null;
};

/** What the harness gives the script. Injected so topologies run under test with fakes. */
export type AgentOptions = {
  label?: string;
  phase?: string;
  schema?: Record<string, unknown>;
  effort?: string;
};
export type Runtime = {
  agent: (prompt: string, opts?: AgentOptions) => Promise<unknown>;
  parallel: <T>(thunks: Array<() => Promise<T>>) => Promise<Array<T | null>>;
  log: (message: string) => void;
};
