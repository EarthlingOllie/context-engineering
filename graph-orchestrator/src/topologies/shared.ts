/**
 * What every topology shares: the caps, the runtime context, the one role
 * agent call, the result shapers and the dispatch trace event. A topology file
 * imports from here and from roles.ts; nothing in here knows a topology.
 */
import type { DispatchResult, DispatchSpec, ReturnContract, RoleEntry, Runtime, Topology, TraceEvent } from "../types.ts";
import { ROLE_SCHEMAS, type RoleName } from "../roles.ts";
import { type AgentLabelParts, agentLabel } from "../labels.ts";

/** What a role call says about itself for its agent label; the stage prefix comes from the spec id. */
export type RoleLabel = Omit<AgentLabelParts, "id">;

export const MAX_LINES = 20;
export const MAX_WIDTH = 9;
export const MAX_PARTICIPANTS = 6;
export const DEFAULT_ITERATIONS = 3;
export const DEFAULT_ROUNDS = 2;
export const DEFAULT_WIDTH = 3;
/** relay: sessions per dispatch. */
export const MAX_SESSIONS = 10;
export const DEFAULT_SESSIONS = 3;
/** iterative-fan-out: gap-filling rounds per dispatch. */
export const MAX_GAP_ROUNDS = 3;
export const DEFAULT_GAP_ROUNDS = 2;
/** debate: rounds per dispatch (worst case 6 × 4 + 1 = 25 agents). */
export const MAX_DEBATE_ROUNDS = 4;

export type TopologyContext = {
  rt: Runtime;
  artifactDir: string;
  wave: number;
  /** Chain stages record their own dispatch events here, tagged with `parent`. */
  stageEvents: TraceEvent[];
};

/**
 * What a topology file contributes to the registry in dispatch.ts: the upper
 * bound on the agents a spec may spawn (0 when a cap would refuse it unrun),
 * and the run itself.
 */
export type TopologyImpl = {
  demand(spec: Partial<DispatchSpec>, params: Record<string, unknown>): number;
  run(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult>;
};

/**
 * A topology's own param check, run before any agent is spent: either the
 * narrowed params, or the result to return unrun (`over_budget` for a cap
 * breach, `failed` for malformed or missing params).
 */
export type Checked<P> = { ok: true; params: P } | { ok: false; result: DispatchResult };

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

/** What a spec inherits when it leaves a field out: a chain stage takes its parent's id numbering, context and return contract. */
export type SpecDefaults = { id?: string; context?: string[]; returns?: ReturnContract };

/**
 * A spec as the orchestrator wrote it (JSON, so any field may be missing or
 * the wrong type), put into the shape the topologies read. The topology is
 * carried as written; `runDispatch` validates it. `defaults.context` goes
 * before the spec's own lines.
 */
export function normaliseSpec(raw: unknown, defaults: SpecDefaults = {}): DispatchSpec {
  const { title: rawTitle, ...s } = (raw && typeof raw === "object" ? raw : {}) as Partial<DispatchSpec>;
  const title = typeof rawTitle === "string" ? rawTitle.replace(/\s+/g, " ").trim() : "";
  return {
    ...s,
    ...(title ? { title } : {}),
    id: typeof s.id === "string" && s.id ? s.id : (defaults.id ?? "?"),
    topology: s.topology as Topology,
    task: typeof s.task === "string" ? s.task : "",
    context: [...(defaults.context ?? []), ...(Array.isArray(s.context) ? s.context.map(String) : [])],
    roles: s.roles && typeof s.roles === "object" ? s.roles : {},
    params: s.params && typeof s.params === "object" ? s.params : {},
    returns: contractOf(s.returns != null ? s : defaults.returns ? { returns: defaults.returns } : {}),
    dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : [],
  };
}

export function int(v: unknown, fallback: number, min = 1): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

export function str(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function strArr(o: Record<string, unknown>, key: string): string[] {
  const v = o[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}

/** The question when the output reported blocked (a placeholder naming `who` when it gave none), else null. */
export function blockedQuestion(o: Record<string, unknown>, who = "worker"): string | null {
  if (o["blocked"] !== true) return null;
  const q = str(o, "question").trim();
  return q || `(the ${who} reported blocked without a question)`;
}

/** What a role that does work hands back: the inline result (cut to the contract) and the artifact paths. */
export type WorkOutput = { result: string; artifacts: string[] };

/**
 * Read a working role's structured output: its result and artifacts, plus the
 * question when it reported blocked. The caller decides what a blocked or
 * done output becomes; the shape of the read is the same for every role.
 */
export function readWorkOutput(out: Record<string, unknown>, maxLines: number): WorkOutput & { question?: string } {
  const q = blockedQuestion(out);
  const work: WorkOutput = { result: cutLines(str(out, "result"), maxLines), artifacts: strArr(out, "artifacts") };
  return q ? { ...work, question: q } : work;
}

/** A role entry as written (JSON, any shape) normalised to `{ skill?, instructions }`; undefined when it is not an object. */
export function entryOf(raw: unknown): RoleEntry | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Partial<RoleEntry>;
  return { ...(e.skill ? { skill: String(e.skill) } : {}), instructions: String(e.instructions ?? "") };
}

export function roleEntry(spec: DispatchSpec, name: RoleName): RoleEntry | undefined {
  const roles = spec.roles && typeof spec.roles === "object" ? spec.roles : {};
  return entryOf(roles[name]);
}

export function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

export function fail(spec: Partial<DispatchSpec> | null | undefined, message: string, iterations = 0): DispatchResult {
  const id = spec && typeof spec === "object" && spec.id ? String(spec.id) : "?";
  return { id, status: "failed", result: message, artifacts: [], iterations };
}

export function overBudget(spec: DispatchSpec, message: string): DispatchResult {
  return { id: spec.id, status: "over_budget", result: message, artifacts: [], iterations: 0 };
}

/**
 * One role agent call. Returns the parsed structured output or null. An agent
 * that throws is logged and counts as returning nothing, so the topology's
 * null path answers with what it had accumulated so far (artifacts, iterations).
 */
export async function callRole(
  ctx: TopologyContext,
  spec: DispatchSpec,
  role: RoleName,
  prompt: string,
  roleLabel: RoleLabel,
  schema: Record<string, unknown> = ROLE_SCHEMAS[role],
): Promise<Record<string, unknown> | null> {
  const label = agentLabel({ ...roleLabel, id: spec.id });
  let out: unknown;
  try {
    out = await ctx.rt.agent(prompt, { label, schema });
  } catch (err) {
    ctx.rt.log(`${spec.id}: ${label} threw: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  if (!out || typeof out !== "object") return null;
  return out as Record<string, unknown>;
}

export function dispatchEvent(wave: number, spec: DispatchSpec, r: DispatchResult, parent?: string): TraceEvent {
  const e: Extract<TraceEvent, { type: "dispatch" }> = {
    type: "dispatch",
    wave,
    id: spec.id,
    ...(spec.title ? { title: spec.title } : {}),
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
