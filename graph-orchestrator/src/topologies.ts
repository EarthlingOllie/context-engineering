/**
 * The topologies: single, generator-evaluator, fan-out, chain (and the debate
 * placeholder). Each is a plain async function over an injected runtime, so
 * the whole module runs under test with a fake `agent()`.
 *
 * Caps: width ≤ 9, participants ≤ 6, maxLines ≤ 20. A spec that exceeds a cap
 * returns `over_budget` without spending an agent. Nothing in here throws for a
 * bad spec; it returns `failed` so a wave always comes back whole.
 */
import type {
  ChainParams,
  DispatchResult,
  DispatchSpec,
  DispatchStatus,
  FanOutParams,
  GeneratorEvaluatorParams,
  ReturnContract,
  RoleEntry,
  Runtime,
  TraceEvent,
} from "./types.ts";
import { TOPOLOGIES } from "./types.ts";
import { buildPrompt, ROLE_SCHEMAS, type RoleName } from "./roles.ts";

export const MAX_LINES = 20;
export const MAX_WIDTH = 9;
export const MAX_PARTICIPANTS = 6;
export const DEFAULT_ITERATIONS = 3;
export const DEFAULT_ROUNDS = 2;
export const DEFAULT_WIDTH = 3;

export type TopologyContext = {
  rt: Runtime;
  artifactDir: string;
  wave: number;
  /** Chain stages record their own dispatch events here, tagged with `parent`. */
  stageEvents: TraceEvent[];
};

// ---------- small helpers ----------

export function cutLines(text: string, maxLines: number): string {
  const lines = String(text ?? "").split("\n");
  if (lines.length <= maxLines) return lines.join("\n");
  return lines.slice(0, maxLines).join("\n");
}

export function firstLine(text: string): string {
  return String(text ?? "").split("\n")[0] ?? "";
}

/** Context lines that carry a finished dispatch forward to one that builds on it: status, first line, artifact paths. */
export function forwardLines(r: DispatchResult): string[] {
  return [`${r.id} (${r.status}) returned: ${firstLine(r.result)}`, ...(r.artifacts.length ? [`artifacts from ${r.id}: ${r.artifacts.join(", ")}`] : [])];
}

/** The return contract, clamped to the inline ceiling. */
export function contractOf(spec: Partial<DispatchSpec>): ReturnContract {
  const shape = typeof spec.returns?.shape === "string" && spec.returns.shape ? spec.returns.shape : "the result";
  const raw = Number(spec.returns?.maxLines);
  const maxLines = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), MAX_LINES) : MAX_LINES;
  return { shape, maxLines };
}

function int(v: unknown, fallback: number, min = 1): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function str(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function strArr(o: Record<string, unknown>, key: string): string[] {
  const v = o[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}

function blockedQuestion(o: Record<string, unknown>): string | null {
  if (o["blocked"] !== true) return null;
  const q = str(o, "question").trim();
  return q || "(the worker reported blocked without a question)";
}

function roleEntry(spec: DispatchSpec, name: RoleName): RoleEntry | undefined {
  const roles = spec.roles && typeof spec.roles === "object" ? spec.roles : {};
  const e = roles[name];
  if (e && typeof e === "object") return { ...(e.skill ? { skill: String(e.skill) } : {}), instructions: String(e.instructions ?? "") };
  return undefined;
}

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

export function fail(spec: Partial<DispatchSpec> | null | undefined, message: string, iterations = 0): DispatchResult {
  const id = spec && typeof spec === "object" && spec.id ? String(spec.id) : "?";
  return { id, status: "failed", result: message, artifacts: [], iterations };
}

function overBudget(spec: DispatchSpec, message: string): DispatchResult {
  return { id: spec.id, status: "over_budget", result: message, artifacts: [], iterations: 0 };
}

/** One role agent call. Returns the parsed structured output or null. */
async function callRole(
  ctx: TopologyContext,
  spec: DispatchSpec,
  role: RoleName,
  prompt: string,
  label: string,
  schema: Record<string, unknown> = ROLE_SCHEMAS[role],
): Promise<Record<string, unknown> | null> {
  const out = await ctx.rt.agent(prompt, { label: `${spec.id} ${label}`, phase: spec.id, schema });
  if (!out || typeof out !== "object") return null;
  return out as Record<string, unknown>;
}

// ---------- agent demand ----------

/** Upper bound on the agents a dispatch may spawn. Logged against the cap; never used to refuse. */
export function agentDemand(raw: Partial<DispatchSpec> | null | undefined): number {
  const spec: Partial<DispatchSpec> = raw && typeof raw === "object" ? raw : {};
  const params = (spec.params && typeof spec.params === "object" ? spec.params : {}) as Record<string, unknown>;
  switch (spec.topology) {
    case "single":
      return 1;
    case "generator-evaluator":
      return 2 * int(params["max_iterations"], DEFAULT_ITERATIONS);
    case "fan-out": {
      const split = params["split"];
      const width = Array.isArray(split) ? split.length : int(params["width"], DEFAULT_WIDTH);
      const partition = typeof split === "string" ? 1 : 0;
      const reducer = params["reducer"] || (spec.roles ?? {})["reducer"] ? 1 : 0;
      return partition + width + reducer;
    }
    case "debate": {
      const p = params["participants"];
      const n = Array.isArray(p) ? p.length : 0;
      return n * int(params["rounds"], DEFAULT_ROUNDS) + 1;
    }
    case "chain": {
      const stages = params["stages"];
      return Array.isArray(stages) ? stages.reduce((s: number, st) => s + agentDemand(st as DispatchSpec), 0) : 0;
    }
    default:
      return 0;
  }
}

// ---------- single ----------

async function runSingle(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const out = await callRole(
    ctx,
    spec,
    "worker",
    buildPrompt({ role: "worker", task: spec.task, context: spec.context, entry: roleEntry(spec, "worker"), returns, artifactDir: ctx.artifactDir }),
    "worker",
  );
  if (!out) return fail(spec, "worker returned nothing", 1);
  const q = blockedQuestion(out);
  const base = { id: spec.id, result: cutLines(str(out, "result"), returns.maxLines), artifacts: strArr(out, "artifacts"), iterations: 1 };
  return q ? { ...base, status: "blocked", question: q } : { ...base, status: "done" };
}

// ---------- generator-evaluator ----------

async function runGeneratorEvaluator(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const params = spec.params as Partial<GeneratorEvaluatorParams>;
  const maxIterations = int(params.max_iterations, DEFAULT_ITERATIONS);
  const criteria = typeof params.pass_criteria === "string" && params.pass_criteria ? params.pass_criteria : "the task is complete and correct";
  const genEntry = roleEntry(spec, "generator");
  const evalEntry = roleEntry(spec, "evaluator");

  let feedback: string | null = null;
  let last: { result: string; artifacts: string[] } | null = null;

  for (let round = 1; round <= maxIterations; round++) {
    const sections: Array<{ title: string; body: string }> = [];
    if (feedback !== null && last) {
      sections.push({ title: `FEEDBACK (evaluator, round ${round - 1})`, body: feedback || "(no feedback given)" });
      sections.push({ title: "YOUR ARTIFACTS FROM THE PREVIOUS ROUND (re-open from disk as needed)", body: last.artifacts.length ? last.artifacts.join("\n") : "none" });
    }
    sections.push({ title: "PASS CRITERIA (what the evaluator will check)", body: criteria });
    const gen = await callRole(
      ctx,
      spec,
      "generator",
      buildPrompt({ role: "generator", task: spec.task, context: spec.context, entry: genEntry, returns, artifactDir: ctx.artifactDir, sections }),
      `generator r${round}`,
    );
    if (!gen) return fail(spec, `generator returned nothing in round ${round}`, round);
    const gq = blockedQuestion(gen);
    last = { result: cutLines(str(gen, "result"), returns.maxLines), artifacts: strArr(gen, "artifacts") };
    if (gq) return { id: spec.id, status: "blocked", result: last.result, artifacts: last.artifacts, question: gq, iterations: round };

    const ev = await callRole(
      ctx,
      spec,
      "evaluator",
      buildPrompt({
        role: "evaluator",
        task: spec.task,
        context: spec.context,
        entry: evalEntry,
        returns: { shape: "pass or fail with numbered feedback", maxLines: 10 },
        artifactDir: ctx.artifactDir,
        sections: [
          { title: "PASS CRITERIA", body: criteria },
          { title: `SUBMISSION (round ${round})`, body: `${last.result}\nartifacts: ${last.artifacts.length ? last.artifacts.join(", ") : "none"}` },
        ],
      }),
      `evaluator r${round}`,
    );
    if (!ev) return fail(spec, `evaluator returned nothing in round ${round}`, round);
    const eq = blockedQuestion(ev);
    if (eq) return { id: spec.id, status: "blocked", result: last.result, artifacts: last.artifacts, question: eq, iterations: round };
    if (ev["pass"] === true) return { id: spec.id, status: "done", result: last.result, artifacts: last.artifacts, iterations: round };
    feedback = str(ev, "feedback");
  }

  // The feedback line always survives the cut: the result gives up its last line for it.
  const tail = `-- exhausted after ${maxIterations} round(s); last evaluator feedback: ${firstLine(feedback ?? "")}`;
  const head = returns.maxLines > 1 ? cutLines(last?.result ?? "", returns.maxLines - 1) : "";
  return {
    id: spec.id,
    status: "exhausted",
    result: head ? `${head}\n${tail}` : tail,
    artifacts: last?.artifacts ?? [],
    iterations: maxIterations,
  };
}

// ---------- fan-out ----------

type Branch = { index: number; task: string; status: DispatchStatus; result: string; artifacts: string[]; question?: string };

async function runFanOut(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const params = spec.params as Partial<FanOutParams>;
  const split = params.split;
  const reducerEntry = roleEntry(spec, "reducer") ?? (params.reducer && typeof params.reducer === "object" ? params.reducer : undefined);
  const hasReducer = Boolean(reducerEntry) || params.reducer === true;
  const workerEntry = roleEntry(spec, "worker");

  // 1. Decide the sub-tasks: explicit list, or a partition agent following the instruction.
  let subtasks: string[];
  if (Array.isArray(split)) {
    subtasks = split.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    if (subtasks.length === 0) return fail(spec, "fan-out: `split` list is empty");
    if (subtasks.length > MAX_WIDTH) return overBudget(spec, `fan-out: ${subtasks.length} sub-tasks exceeds the width cap of ${MAX_WIDTH}; split differently or chain two fan-outs`);
    if (params.width !== undefined && int(params.width, subtasks.length) !== subtasks.length) {
      ctx.rt.log(`${spec.id}: width ${String(params.width)} ignored; explicit split has ${subtasks.length} sub-tasks`);
    }
  } else if (typeof split === "string" && split.trim()) {
    const width = int(params.width, DEFAULT_WIDTH);
    if (width > MAX_WIDTH) return overBudget(spec, `fan-out: width ${width} exceeds the cap of ${MAX_WIDTH}`);
    const part = await callRole(
      ctx,
      spec,
      "worker",
      buildPrompt({
        role: "worker",
        task: `Partition this task into at most ${width} independent sub-tasks: ${spec.task}`,
        context: spec.context,
        entry: workerEntry,
        returns: { shape: "one imperative sentence per sub-task, each self-contained and non-overlapping", maxLines: width },
        artifactDir: ctx.artifactDir,
        sections: [{ title: "PARTITION INSTRUCTION", body: split }],
      }),
      "partition",
      {
        type: "object",
        properties: {
          subtasks: { type: "array", items: { type: "string" }, description: `At most ${width} independent sub-tasks, one imperative sentence each.` },
          blocked: { type: "boolean" },
          question: { type: "string" },
        },
        required: ["subtasks", "blocked"],
      },
    );
    if (!part) return fail(spec, "fan-out: partition agent returned nothing", 1);
    const pq = blockedQuestion(part);
    if (pq) return { id: spec.id, status: "blocked", result: "", artifacts: [], question: pq, iterations: 1 };
    subtasks = strArr(part, "subtasks").slice(0, width);
    if (subtasks.length === 0) return fail(spec, "fan-out: partition produced no sub-tasks", 1);
    if (strArr(part, "subtasks").length > width) ctx.rt.log(`${spec.id}: partition returned more than ${width} sub-tasks; extras dropped`);
  } else {
    return fail(spec, "fan-out: `params.split` must be a list of sub-tasks or a partition instruction");
  }

  // 2. Branches in parallel. Without a reducer the inline results are concatenated, so each gets a share of the lines.
  const n = subtasks.length;
  const branchReturns: ReturnContract = hasReducer ? returns : { shape: returns.shape, maxLines: Math.max(1, Math.floor(returns.maxLines / n)) };
  const raw = await ctx.rt.parallel(
    subtasks.map((task, i) => async (): Promise<Branch> => {
      const out = await callRole(
        ctx,
        spec,
        "worker",
        buildPrompt({
          role: "worker",
          task,
          context: [...spec.context, `this is branch ${i + 1} of ${n} of a fan-out whose parent task is: ${spec.task}`],
          entry: workerEntry,
          returns: branchReturns,
          artifactDir: ctx.artifactDir,
        }),
        `branch ${i + 1}/${n}`,
      );
      if (!out) return { index: i, task, status: "failed", result: "worker returned nothing", artifacts: [] };
      const q = blockedQuestion(out);
      const b: Branch = { index: i, task, status: q ? "blocked" : "done", result: cutLines(str(out, "result"), branchReturns.maxLines), artifacts: strArr(out, "artifacts") };
      if (q) b.question = q;
      return b;
    }),
  );
  const branches: Branch[] = raw.map((b, i) => b ?? { index: i, task: subtasks[i] ?? "", status: "failed", result: "branch did not return", artifacts: [] });
  const finished = branches.filter((b) => b.status === "done");
  const blocked = branches.filter((b) => b.status === "blocked");
  const artifacts = uniq(branches.flatMap((b) => b.artifacts));
  const gapQuestion = blocked.length ? blocked.map((b) => `branch ${b.index + 1} (${b.task}): ${b.question}`).join("\n") : undefined;

  if (finished.length === 0) {
    const status: DispatchStatus = blocked.length ? "blocked" : "failed";
    const base = { id: spec.id, status, result: cutLines(branches.map((b) => `branch ${b.index + 1} ${b.status}: ${b.question ?? b.result}`).join("\n"), returns.maxLines), artifacts, iterations: 1 };
    return gapQuestion ? { ...base, question: gapQuestion } : base;
  }

  // 3. Reduce over the finished branches, noting the gaps; or concatenate.
  let result: string;
  let extraArtifacts: string[] = [];
  if (hasReducer) {
    const body = branches
      .map((b) => (b.status === "done" ? `branch ${b.index + 1} (done) — ${b.task}\n${b.result}\nartifacts: ${b.artifacts.length ? b.artifacts.join(", ") : "none"}` : `branch ${b.index + 1} (${b.status}) — ${b.task}\nGAP: ${b.question ?? b.result}`))
      .join("\n\n");
    const red = await callRole(
      ctx,
      spec,
      "reducer",
      buildPrompt({ role: "reducer", task: spec.task, context: spec.context, entry: reducerEntry, returns, artifactDir: ctx.artifactDir, sections: [{ title: "BRANCH RESULTS", body }] }),
      "reducer",
    );
    if (!red) return { id: spec.id, status: "failed", result: "reducer returned nothing", artifacts, iterations: 1 };
    const rq = blockedQuestion(red);
    if (rq) return { id: spec.id, status: "blocked", result: cutLines(str(red, "result"), returns.maxLines), artifacts, question: rq, iterations: 1 };
    result = cutLines(str(red, "result"), returns.maxLines);
    extraArtifacts = strArr(red, "artifacts");
  } else {
    result = cutLines(branches.map((b) => (b.status === "done" ? `[${b.index + 1}] ${b.result}` : `[${b.index + 1}] ${b.status}: ${b.question ?? b.result}`)).join("\n"), returns.maxLines);
  }
  const done: DispatchResult = { id: spec.id, status: "done", result, artifacts: uniq([...artifacts, ...extraArtifacts]), iterations: 1 };
  return gapQuestion ? { ...done, question: gapQuestion } : done;
}

// ---------- debate ----------

/**
 * Deliberately not built here. Spec story 42: the first real task run through
 * the orchestrator is building the debate topology itself, so that the design
 * is proven by use. The signature, caps, roles (judge, debater) and the
 * catalog entry are in place; this function is what the dogfood task replaces.
 */
async function runDebate(_ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const params = spec.params ?? {};
  const p = params["participants"];
  if (Array.isArray(p) && p.length > MAX_PARTICIPANTS) return overBudget(spec, `debate: ${p.length} participants exceeds the cap of ${MAX_PARTICIPANTS}`);
  return fail(spec, "debate is not built in this plugin version: it is the dogfood task (spec story 42). Use generator-evaluator or a fan-out with a reducer for now.");
}

// ---------- chain ----------

function normaliseStage(parent: DispatchSpec, stage: unknown, index: number, forwarded: string[]): DispatchSpec {
  const s = (stage && typeof stage === "object" ? stage : {}) as Partial<DispatchSpec>;
  return {
    id: typeof s.id === "string" && s.id ? s.id : `${parent.id}-s${index + 1}`,
    topology: s.topology as DispatchSpec["topology"],
    task: typeof s.task === "string" ? s.task : "",
    context: [...parent.context, ...(Array.isArray(s.context) ? s.context : []), ...forwarded],
    roles: s.roles && typeof s.roles === "object" ? s.roles : {},
    params: s.params && typeof s.params === "object" ? s.params : {},
    returns: s.returns ?? parent.returns,
    dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn : [],
  };
}

async function runChain(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const stages = (spec.params as Partial<ChainParams>).stages;
  if (!Array.isArray(stages) || stages.length === 0) return fail(spec, "chain: `params.stages` must be a non-empty list of dispatch specs");

  const statuses: string[] = [];
  const artifacts: string[] = [];
  let prev: DispatchResult | null = null;
  for (let i = 0; i < stages.length; i++) {
    const forwarded = prev ? forwardLines(prev) : [];
    const stage = normaliseStage(spec, stages[i], i, forwarded);
    const r = await runDispatch(ctx, stage);
    ctx.stageEvents.push(dispatchEvent(ctx.wave, stage, r, spec.id));
    statuses.push(`${stage.id}:${r.status}`);
    artifacts.push(...r.artifacts);
    if (r.status !== "done") {
      const out: DispatchResult = {
        id: spec.id,
        status: r.status,
        result: cutLines(`stage ${stage.id} ${r.status}: ${r.result}`, returns.maxLines),
        artifacts: uniq(artifacts),
        iterations: i + 1,
        stages: statuses,
      };
      if (r.question) out.question = r.question;
      return out;
    }
    prev = r;
  }
  return { id: spec.id, status: "done", result: cutLines(prev?.result ?? "", returns.maxLines), artifacts: uniq(artifacts), iterations: stages.length, stages: statuses };
}

// ---------- dispatch ----------

export function dispatchEvent(wave: number, spec: DispatchSpec, r: DispatchResult, parent?: string): TraceEvent {
  const e: Extract<TraceEvent, { type: "dispatch" }> = {
    type: "dispatch",
    wave,
    id: spec.id,
    topology: String(spec.topology),
    iterations: r.iterations,
    status: r.status,
    dependsOn: Array.isArray(spec.dependsOn) ? spec.dependsOn : [],
  };
  if (r.stages) e.stages = r.stages;
  if (parent) e.parent = parent;
  if (r.question) e.question = firstLine(r.question);
  return e;
}

/** Run one dispatch spec. Never throws: a spec that cannot run returns `failed`. */
export async function runDispatch(ctx: TopologyContext, raw: DispatchSpec): Promise<DispatchResult> {
  if (!raw || typeof raw !== "object") return fail({ id: "?" }, "dispatch spec is not an object");
  if (typeof raw.id !== "string" || !raw.id) return fail({ id: "?" }, "dispatch spec has no id");
  if (!TOPOLOGIES.includes(raw.topology)) return fail(raw, `unknown topology "${String(raw.topology)}"; valid: ${TOPOLOGIES.join(", ")}`);
  const spec: DispatchSpec = {
    ...raw,
    task: typeof raw.task === "string" ? raw.task : "",
    context: Array.isArray(raw.context) ? raw.context.map(String) : [],
    roles: raw.roles && typeof raw.roles === "object" ? raw.roles : {},
    params: raw.params && typeof raw.params === "object" ? raw.params : {},
    returns: contractOf(raw),
    dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String) : [],
  };
  if (!spec.task) return fail(spec, "dispatch spec has no task");
  try {
    switch (spec.topology) {
      case "single":
        return await runSingle(ctx, spec);
      case "generator-evaluator":
        return await runGeneratorEvaluator(ctx, spec);
      case "fan-out":
        return await runFanOut(ctx, spec);
      case "debate":
        return await runDebate(ctx, spec);
      case "chain":
        return await runChain(ctx, spec);
    }
  } catch (err) {
    return fail(spec, `topology threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}
