/**
 * What every topology shares: the caps, the runtime context, the one role
 * agent call, the result shapers and the dispatch trace event. A topology file
 * imports from here and from roles.ts; nothing in here knows a topology.
 */
import type { DispatchResult, DispatchSpec, ReturnContract, RoleEntry, Runtime, TraceEvent } from "../types.ts";
import { ROLE_SCHEMAS, type RoleName } from "../roles.ts";

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

/**
 * What a topology file contributes to the registry in dispatch.ts: the upper
 * bound on the agents a spec may spawn (0 when a cap would refuse it unrun),
 * and the run itself.
 */
export type TopologyImpl = {
  demand(spec: Partial<DispatchSpec>, params: Record<string, unknown>): number;
  run(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult>;
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

export function blockedQuestion(o: Record<string, unknown>): string | null {
  if (o["blocked"] !== true) return null;
  const q = str(o, "question").trim();
  return q || "(the worker reported blocked without a question)";
}

export function roleEntry(spec: DispatchSpec, name: RoleName): RoleEntry | undefined {
  const roles = spec.roles && typeof spec.roles === "object" ? spec.roles : {};
  const e = roles[name];
  if (e && typeof e === "object") return { ...(e.skill ? { skill: String(e.skill) } : {}), instructions: String(e.instructions ?? "") };
  return undefined;
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
  label: string,
  schema: Record<string, unknown> = ROLE_SCHEMAS[role],
): Promise<Record<string, unknown> | null> {
  let out: unknown;
  try {
    out = await ctx.rt.agent(prompt, { label: `${spec.id} ${label}`, phase: spec.id, schema });
  } catch (err) {
    ctx.rt.log(`${spec.id} ${label} threw: ${err instanceof Error ? err.message : String(err)}`);
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
