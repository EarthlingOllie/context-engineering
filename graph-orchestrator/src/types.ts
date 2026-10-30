/**
 * The signature every topology accepts from and returns to the orchestrator.
 * These are the types the planning prompt targets and the Workflow consumes.
 * Vocabulary: CONTEXT.md.
 */

export const TOPOLOGIES = ["single", "generator-evaluator", "fan-out", "debate", "chain"] as const;
export type Topology = (typeof TOPOLOGIES)[number];

/** A role slot filled at dispatch time: the skill supplies the domain, the instructions the task. */
export type RoleEntry = { skill?: string; instructions: string };

export type ReturnContract = { shape: string; maxLines: number }; // maxLines ≤ 20

export type DispatchSpec = {
  id: string; // "w3-d2"
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
  rounds?: number; // default 2
  judge?: RoleEntry; // or roles.judge (required one way or the other)
};
export type ChainParams = { stages: DispatchSpec[] };

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

export type WaveArgs = {
  now: string; // ISO timestamp supplied by the orchestrator; scripts cannot read the clock
  traceFile: string;
  maxAgents: number; // the effective concurrency cap, for the demand log only
  dispatches: DispatchSpec[];
  wave?: number; // derived from the ids ("w3-…") when absent
  artifactDir?: string; // where roles write overflow; defaults to the trace file's directory
  humans?: HumanEvent[]; // interventions since the last wave, written by the scribe first
};

export type TraceEvent =
  | { type: "wave_start"; wave: number; at: string; dispatches: number; demand: number; cap: number }
  | {
      type: "dispatch";
      wave: number;
      id: string;
      topology: string;
      iterations: number;
      status: DispatchStatus;
      dependsOn: string[];
      stages?: string[];
      parent?: string; // for chain stages
      question?: string;
    }
  | { type: "wave_end"; wave: number; at: string; done: number; blocked: number; exhausted: number; over_budget: number; failed: number }
  | HumanEvent;

export type WaveReturn = {
  status: "done";
  wave: number;
  results: DispatchResult[];
  demand: number;
  cap: number;
  events: TraceEvent[];
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
