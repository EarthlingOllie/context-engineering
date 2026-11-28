/**
 * The signature every topology accepts from and returns to the orchestrator.
 * These are the types the planning prompt targets and the Workflow consumes.
 * Vocabulary: CONTEXT.md.
 */

export const TOPOLOGIES = ["single", "generator-evaluator", "fan-out", "debate", "chain", "relay", "best-of-n", "iterative-fan-out", "panel"] as const;
export type Topology = (typeof TOPOLOGIES)[number];

/**
 * A role slot filled at dispatch time: the skill supplies the domain, the instructions the task.
 * `model` (ticket 07) overrides the model the role runs on (src/models.ts); without it scribe and partition
 * run on Haiku and every other role on the session model.
 */
export type RoleEntry = { skill?: string; instructions: string; model?: string };

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
export type GeneratorEvaluatorParams = { max_iterations?: number; pass_criteria: string }; // pass_criteria required: missing or blank → failed, no agent spent
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
/** A chain stage: a dispatch spec; a non-last panel stage stops the chain on FAIL unless it sets `gate: false`. */
export type ChainStage = DispatchSpec & { gate?: boolean };
export type ChainParams = { stages: ChainStage[] };
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
 * `failed` is part of the orchestrator-facing signature (CONTEXT.md,
 * Signature): what a dispatch returns instead of throwing when it cannot run
 * or finish (unknown topology, malformed params, an agent that returned
 * nothing or threw; a thrown message is carried in the result).
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
  /** Local artifact paths the result claims that the engine's artifact check did not find (finding A); absent when every one was found or none was checked. */
  missing?: string[];
};

/**
 * One agent of a dispatch as its trace line records it: the role its label
 * names, and only the usage a Workflow script can read (ticket 02). That is
 * `output_tokens`, the `budget.spent()` delta across the call, recorded only
 * when no other agent of the dispatch ran during it; unreadable figures are
 * left out, never zeroed. The pool behind `budget.spent()` is shared by every
 * workflow in the turn, so a dispatch running beside others can over-count.
 */
/** One agent on a dispatch line: its role, its readable usage (B-05), and the refusal counts it reported (B-07); a field is absent when not known. */
export type AgentUsage = { role: string; output_tokens?: number; writes_refused?: number; tools_denied?: number };

/**
 * One evaluator round as a dispatch line records it (B-06): its verdict and,
 * for fail or blocked, the first line of its feedback or question.
 */
export type EvaluatorRound = { round: number; verdict: "pass" | "fail" | "blocked"; feedback?: string };

/** A human intervention, written by the orchestrator (via the next wave or the renderer). */
export type HumanEvent = {
  type: "human";
  at?: string;
  trigger: "ambiguity" | "blocked" | "exhausted" | "irreversible" | "budget";
  dispatch?: string; // the dispatch that raised it, if any
  question: string;
  answer: string;
  mode?: "attended" | "autonomous";
  /** Who answered (B-06): `human` when a person did, `self` for an autonomous best guess. Old lines lack it; the renderer then falls back to `mode`. */
  source?: "self" | "human";
};

/**
 * A hook message (a Stop hook's git check, a commit or push reminder) that
 * reached the session. It is never a human answer and never an intervention:
 * the trace records that it fired, and the renderer draws nothing for it.
 */
export type HookEvent = {
  type: "hook";
  at?: string;
  hook: string; // the hook's event name, e.g. "Stop"
  dispatch?: string; // the running dispatch that owned the tree when it fired, if any
  message?: string; // the hook's first line
};

/** The args of one dispatch workflow run. */
export type DispatchArgs = {
  now?: string; // optional start time; without it the trace's writer stamps the start and end from the clock (B-04)
  scratch: string; // the session scratch directory: artifacts go here, the trace line to <scratch>/trace/<id>.jsonl
  dispatch: DispatchSpec;
  humans?: Array<HumanEvent | HookEvent>; // interventions (and hook events) since the last wave, written by the scribe before the dispatch line
};

export type TraceEvent =
  | { type: "wave_start"; wave: number; at: string; dispatches: number; demand: number; cap: number } // v0.2 traces only
  | {
      type: "dispatch";
      wave: number;
      id: string;
      title?: string;
      at?: string; // the start: UTC, from the clock via the trace's writer (B-04); invented by the orchestrator on older lines
      /** The end: UTC, the time the trace's writer appended the line (B-04). Absent on older lines. */
      ended?: string;
      topology: string;
      iterations: number;
      status: DispatchStatus;
      dependsOn: string[];
      stages?: string[];
      parent?: string; // for chain stages
      question?: string;
      /** Every agent the dispatch ran, in call order (not the scribe, which writes this line). Absent on older lines and on chain stage lines. */
      agents?: AgentUsage[];
      /** The agents the dispatch needed: its topology's upper bound (agentDemand), 0 when refused unrun. */
      demand?: number;
      /** The most agents the dispatch had running at once; 0 when none ran. */
      concurrency?: number;
      /** generator-evaluator and iterative-fan-out: the criteria the evaluator checked, once (B-06). */
      criteria?: string;
      /** generator-evaluator and iterative-fan-out: each evaluator round's verdict and first feedback line, in order. */
      rounds?: EvaluatorRound[];
      /** chain only: each run stage's `<id> <status>: <first line>`. */
      stageLines?: string[];
      /** The build that wrote the line (B-03): `<package version>+<git short commit>`, `dev` from unbundled source. Absent on older lines. */
      version?: string;
      /** Lines the dispatch's cuts dropped, in total; absent when none. A chain's line counts every cut under it. */
      dropped?: number;
      /** Writes refused and tools denied, totalled over the agents that reported them (B-07); absent when none did. A `single`'s worker fills in its own. */
      writes_refused?: number;
      tools_denied?: number;
      /** Local artifact paths the result claimed that the artifact check did not find; absent when none. */
      missing?: string[];
    }
  | { type: "wave_end"; wave: number; at: string; done: number; blocked: number; exhausted: number; over_budget: number; failed: number } // v0.2 traces only
  | HumanEvent
  | HookEvent;

/** What a dispatch workflow returns: the result, and whether its trace lines were written. */
export type DispatchReturn = DispatchResult & {
  title?: string;
  /** The build that ran the dispatch (B-03): `<package version>+<git short commit>`, `dev` from unbundled source. */
  version: string;
  scribe: { appended: number; totalLines: number } | null;
  /** Who wrote the trace lines: a `single`'s worker as its final step, else the scribe; absent when none were written. */
  tracedBy?: "worker" | "scribe";
};

/** What the harness gives the script. Injected so topologies run under test with fakes. */
export type AgentOptions = {
  label?: string;
  phase?: string;
  schema?: Record<string, unknown>;
  effort?: string;
  /** The model the agent runs on ("haiku", "sonnet", or a full id); absent runs it on the session model. An unknown model makes `agent()` return null. */
  model?: string;
};
export type Runtime = {
  agent: (prompt: string, opts?: AgentOptions) => Promise<unknown>;
  parallel: <T>(thunks: Array<() => Promise<T>>) => Promise<Array<T | null>>;
  log: (message: string) => void;
  /** The Workflow harness's `budget` global: `spent()` is output tokens spent this turn. Optional; absent or without `spent`, no usage is recorded. */
  budget?: { spent?: () => number } | null;
};
