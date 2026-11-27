/**
 * runWorkflow: one dispatch, as one Workflow run. Pure over the injected
 * runtime. The orchestrator starts a wave by launching one of these per
 * dispatch, all at once, each under a wrapper that names the workflow for the
 * dispatch's purpose; they run in parallel and cannot see each other. The run
 * executes the dispatch's topology, then asks one scribe agent to write the
 * dispatch's trace lines to its own file, <scratch>/trace/<id>.jsonl, so
 * parallel dispatches never write the same file. A `single`'s worker appends
 * those lines itself as its final step; the scribe then runs only when the
 * worker reports none appended (or the result is not the done one it wrote). Its last log line, after
 * the scribe, is `STATUS <status>`: the harness's notification says
 * "completed" for every run that returned, so this line is where a watcher
 * sees the real outcome.
 */
import type { AgentUsage, DispatchArgs, DispatchResult, DispatchReturn, DispatchSpec, HookEvent, HumanEvent, Runtime, TraceEvent } from "./types.ts";
import { agentLabel, roleOfLabel } from "./labels.ts";
import { agentDemand, dispatchEvent, fail, normaliseSpec, runDispatch, traceDetail, type TopologyContext } from "./topologies.ts";

/** The runtime's hard limit on agents per run. */
export const HARD_AGENT_LIMIT = 1000;

/** 3 for `w3-d2`; 0 for an id outside the scheme. */
export function waveOf(id: string): number {
  const m = /^w(\d+)-/.exec(id);
  return m ? Number(m[1]) : 0;
}

export function traceFileOf(scratch: string, id: string): string {
  return `${scratch.replace(/\/+$/, "") || "."}/trace/${id.replace(/[^A-Za-z0-9_.-]/g, "_")}.jsonl`;
}

export function scribePrompt(traceFile: string, lines: string[]): string {
  return [
    "ROLE: scribe",
    `Append the ${lines.length} line(s) between the markers below to the file ${traceFile}, exactly as given, in order, each terminated by a newline.`,
    "Create the directory and the file if they do not exist. Append with a single write; do not read, reorder, reformat or alter any existing line. Do nothing else.",
    "<<<TRACE",
    ...lines,
    "TRACE>>>",
    "Return the number of lines you appended and the total number of lines in the file afterwards.",
  ].join("\n");
}

const SCRIBE_SCHEMA = {
  type: "object",
  properties: { appended: { type: "number" }, totalLines: { type: "number" } },
  required: ["appended", "totalLines"],
};

/**
 * The runtime a dispatch's topology runs on: the given one, with each agent
 * call recorded for the dispatch line (ticket B-05). An agent gets its role
 * from its label, and `output_tokens` from the `budget.spent()` delta across
 * its call only when it ran alone (no other agent of this dispatch started or
 * was running meanwhile) and the budget was readable; otherwise the field is
 * left out. `concurrency` is the most agents running at once.
 */
export function meteredRuntime(rt: Runtime): { runtime: Runtime; agents: () => AgentUsage[]; concurrency: () => number } {
  type Rec = { role: string; overlapped: boolean; before?: number; after?: number };
  const recs: Rec[] = [];
  const running = new Set<Rec>();
  let peak = 0;
  const spent = (): number | undefined => {
    try {
      const b = rt.budget;
      if (!b || typeof b.spent !== "function") return undefined;
      const v = Number(b.spent());
      return Number.isFinite(v) ? v : undefined;
    } catch {
      return undefined;
    }
  };
  const agent: Runtime["agent"] = async (prompt, opts) => {
    const rec: Rec = { role: roleOfLabel(opts?.label), overlapped: running.size > 0 };
    for (const r of running) r.overlapped = true;
    const before = spent();
    if (before !== undefined) rec.before = before;
    recs.push(rec);
    running.add(rec);
    peak = Math.max(peak, running.size);
    try {
      return await rt.agent(prompt, opts);
    } finally {
      running.delete(rec);
      const after = spent();
      if (after !== undefined) rec.after = after;
    }
  };
  const agents = () =>
    recs.map((r): AgentUsage => {
      const delta = !r.overlapped && r.before !== undefined && r.after !== undefined ? r.after - r.before : undefined;
      return delta !== undefined && delta >= 0 ? { role: r.role, output_tokens: delta } : { role: r.role };
    });
  return { runtime: { ...rt, agent }, agents, concurrency: () => peak };
}

/** The per-agent fields of a dispatch line, and the detail its topology recorded (B-06). */
type AgentFields = { agents: AgentUsage[]; demand: number; concurrency: number } & ReturnType<typeof traceDetail>;

/**
 * A human intervention's `source` (B-06): a valid one as given, else from the
 * mode (autonomous is `self`, attended is `human`); absent when neither says.
 */
function withSource(h: HumanEvent): HumanEvent {
  const { source, ...rest } = h;
  const s = source === "self" || source === "human" ? source : h.mode === "autonomous" ? "self" : h.mode === "attended" ? "human" : undefined;
  return s ? { ...rest, source: s } : rest;
}

/** Why a spec cannot run before its topology is asked, or null. */
function refusal(spec: DispatchSpec, demand: number): DispatchResult | null {
  if (demand + 1 > HARD_AGENT_LIMIT) return { id: spec.id, status: "over_budget", result: `not run: ${demand} agent(s) and the scribe would exceed the ${HARD_AGENT_LIMIT}-agent run limit`, artifacts: [], iterations: 0 };
  const wave = waveOf(spec.id);
  const sameWave = wave ? spec.dependsOn.find((d) => waveOf(d) === wave && d !== spec.id) : undefined;
  if (sameWave) return fail(spec, `dependsOn names ${sameWave} from the same wave; each dispatch is its own workflow and cannot wait on another: use a chain, or dispatch this next wave`);
  return null;
}

export async function runWorkflow(args: DispatchArgs, rt: Runtime): Promise<DispatchReturn> {
  const a: Partial<DispatchArgs> = args && typeof args === "object" ? args : {};
  const now = typeof a.now === "string" && a.now ? a.now : "unknown";
  const scratch = typeof a.scratch === "string" && a.scratch ? a.scratch : ".";
  const raw = a.dispatch;
  const spec = normaliseSpec(raw);
  const id = spec.id;
  const wave = waveOf(id);

  // Interventions since the last wave: objects are kept (stamped with now when undated), anything else is dropped and logged.
  // An entry typed `hook` stays a hook event (A-09: a hook is never an intervention); every other object is a human one.
  const rawHumans: unknown[] = Array.isArray(a.humans) ? a.humans : [];
  const humans: Array<HumanEvent | HookEvent> = rawHumans
    .filter((h): h is HumanEvent | HookEvent => !!h && typeof h === "object")
    .map((h) => (h.type === "hook" ? { ...h, type: "hook", at: h.at ?? now } : withSource({ ...(h as HumanEvent), type: "human", at: h.at ?? now })));
  if (humans.length !== rawHumans.length) rt.log(`${id}: dropped ${rawHumans.length - humans.length} malformed humans entry(ies); each must be an object`);

  const demand = agentDemand(raw);
  rt.log(`${id}: ${String(spec.topology)}, up to ${demand} agent(s) + 1 scribe`);

  // Events: interventions, the chain stages, then the dispatch itself.
  const linesOf = (r: DispatchResult, stages: TraceEvent[], fields: AgentFields) => [...humans, ...stages, { ...dispatchEvent(wave, spec, r), ...fields, at: now }].map((e) => JSON.stringify(e));

  const meter = meteredRuntime(rt);
  const ctx: TopologyContext = { rt: meter.runtime, artifactDir: scratch, wave, stageEvents: [] };
  // A `single`'s worker appends the lines a done result would get, as its final step (fixes ticket 08).
  // Its own usage is not known while it writes them, so its agent carries only its role.
  if (raw && typeof raw === "object" && spec.topology === "single" && id !== "?") {
    ctx.selfTrace = { id, file: traceFileOf(scratch, id), lines: linesOf({ id, status: "done", result: "", artifacts: [], iterations: 1 }, [], { agents: [{ role: "worker" }], demand, concurrency: 1 }) };
  }
  let result: DispatchResult;
  if (!raw || typeof raw !== "object") result = fail({ id: "?" }, "args.dispatch is not a dispatch spec");
  else result = refusal(spec, demand) ?? (await runDispatch(ctx, raw));

  const traceFile = traceFileOf(scratch, result.id !== "?" ? result.id : id);
  // Cuts that dropped lines are logged, and counted on the dispatch line (B-06).
  const dropped = ctx.dropped ?? 0;
  if (dropped > 0) rt.log(`${id}: cuts dropped ${dropped} line(s)`);
  const fields: AgentFields = { agents: meter.agents(), demand, concurrency: meter.concurrency(), ...traceDetail(ctx, id, dropped) };
  const lines = linesOf(result, ctx.stageEvents, fields);

  // The worker wrote the lines: no scribe, provided what it wrote is what the result's lines are (its usage and the
  // count its result's cut dropped aside, which it could not know; the log line above records that count).
  const self = ctx.selfTrace;
  if (self && (self.appended ?? 0) > 0) {
    const { dropped: _cut, ...unknowable } = fields;
    const rolesOnly = linesOf(result, ctx.stageEvents, { ...unknowable, agents: fields.agents.map((a) => ({ role: a.role })) });
    if (self.lines.join("\n") === rolesOnly.join("\n")) {
      if (self.appended !== rolesOnly.length) rt.log(`${id}: worker reported ${self.appended} trace line(s) appended, expected ${rolesOnly.length}`);
      rt.log(`STATUS ${result.status}`);
      return { ...result, ...(spec.title ? { title: spec.title } : {}), scribe: { appended: self.appended ?? 0, totalLines: self.totalLines ?? 0 }, tracedBy: "worker" };
    }
    rt.log(`${id}: worker appended ${self.appended} trace line(s) but the dispatch is ${result.status}; the scribe appends the true line(s)`);
  }

  // The scribe: one agent, one write. A throw here must not lose the result.
  const scribeLabel = agentLabel({ role: "scribe", task: "logging current dispatch" });
  let scribe: DispatchReturn["scribe"] = null;
  try {
    const out = await rt.agent(scribePrompt(traceFile, lines), { label: scribeLabel, schema: SCRIBE_SCHEMA });
    if (out && typeof out === "object") {
      const o = out as Record<string, unknown>;
      scribe = { appended: Number(o["appended"]) || 0, totalLines: Number(o["totalLines"]) || 0 };
      if (scribe.appended !== lines.length) rt.log(`${id}: scribe reported ${scribe.appended} line(s) appended, expected ${lines.length}`);
    } else {
      rt.log(`${id}: scribe returned nothing; the trace lines were not written`);
    }
  } catch (err) {
    rt.log(`${id}: scribe threw: ${err instanceof Error ? err.message : String(err)}; the trace lines were not written`);
  }

  rt.log(`STATUS ${result.status}`);
  return { ...result, ...(spec.title ? { title: spec.title } : {}), scribe, ...(scribe ? { tracedBy: "scribe" as const } : {}) };
}
