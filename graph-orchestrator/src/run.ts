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
import { modelOpt } from "./models.ts";
import { END_PLACEHOLDER, START_PLACEHOLDER, TOOLS_DENIED_PLACEHOLDER, WRITES_REFUSED_PLACEHOLDER, argsFileOf, clockSteps, hasPlaceholder } from "./clock.ts";
import { agentDemand, dispatchEvent, fail, normaliseSpec, runDispatch, traceDetail, type TopologyContext } from "./topologies.ts";

declare const __PLUGIN_VERSION__: string | undefined;

/**
 * The build that produced this run (B-03, REL-07): `<package version>+<git short commit>`,
 * injected by build.mjs into workflows/dispatch.js. Unbundled source (tests) reads `dev`.
 */
export const PLUGIN_VERSION: string = typeof __PLUGIN_VERSION__ === "string" && __PLUGIN_VERSION__ ? __PLUGIN_VERSION__ : "dev";

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

export function scribePrompt(traceFile: string, lines: string[], argsFile?: string): string {
  const clock = argsFile && hasPlaceholder(lines) ? clockSteps(argsFile) : [];
  return [
    "ROLE: scribe",
    `Append the ${lines.length} line(s) between the markers below to the file ${traceFile}, ${clock.length ? "exactly as given apart from the time placeholders" : "exactly as given"}, in order, each terminated by a newline.`,
    "Create the directory and the file if they do not exist. Append with a single write; do not read, reorder, reformat or alter any existing line. Do nothing else.",
    ...clock,
    "<<<TRACE",
    ...lines,
    "TRACE>>>",
    "Return the number of lines you appended and the total number of lines in the file afterwards.",
  ].join("\n");
}

/**
 * The artifact paths a result claims that name local files: not a URL (anything with a `scheme://`), not blank,
 * each once, trimmed, in the order claimed.
 */
export function localArtifacts(artifacts: unknown): string[] {
  const out: string[] = [];
  for (const a of Array.isArray(artifacts) ? artifacts : []) {
    if (typeof a !== "string") continue;
    const p = a.trim();
    if (!p || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(p) || out.includes(p)) continue;
    out.push(p);
  }
  return out;
}

export function checkerPrompt(paths: string[]): string {
  return [
    "ROLE: checker",
    `Check whether each of the ${paths.length} path(s) below exists on the local filesystem (a file or a directory; a relative path is relative to your working directory).`,
    "Use one read-only command such as `ls -d` or `test -e`; do not create, open for writing, or change anything. Do nothing else.",
    ...paths.map((p) => `- ${p}`),
    "Return in `missing` every path above, exactly as written, that does not exist; an empty list when all exist.",
  ].join("\n");
}

const CHECKER_SCHEMA = {
  type: "object",
  properties: { missing: { type: "array", items: { type: "string" } } },
  required: ["missing"],
};

/** The question a done result whose claimed artifact is missing is blocked on (finding A). */
export function missingQuestion(missing: string[]): string {
  return missing.map((p) => `artifact ${p} claimed but not found`).join("; ");
}

/**
 * The artifact check (finding A): after the dispatch returns, one checker agent tests that each local artifact
 * path the result claims exists. Missing ones are marked in `missing`; a done result becomes blocked on
 * missingQuestion. Any other status keeps its own status and question. No local path, no agent; a checker that
 * returns nothing or throws leaves the result unchanged, and the log says the check did not run. Like the
 * scribe, the checker is the engine's, not the topology's, so it is not on the dispatch line's `agents`.
 */
async function checkArtifacts(rt: Runtime, spec: DispatchSpec | null, r: DispatchResult): Promise<DispatchResult> {
  const paths = localArtifacts(r.artifacts);
  if (!paths.length) return r;
  let reported: unknown;
  try {
    const out = await rt.agent(checkerPrompt(paths), { label: agentLabel({ role: "checker", task: "artifacts exist" }), schema: CHECKER_SCHEMA, ...modelOpt(spec, "checker") });
    reported = out && typeof out === "object" ? (out as Record<string, unknown>)["missing"] : undefined;
    if (!Array.isArray(reported)) throw new Error("the checker returned no missing list");
  } catch (err) {
    rt.log(`${r.id}: artifact check did not run: ${err instanceof Error ? err.message : String(err)}`);
    return r;
  }
  const said = new Set(reported.filter((p): p is string => typeof p === "string").map((p) => p.trim()));
  const missing = paths.filter((p) => said.has(p));
  if (!missing.length) return r;
  for (const p of missing) rt.log(`${r.id}: artifact ${p} claimed but not found`);
  return r.status === "done" ? { ...r, status: "blocked", question: missingQuestion(missing), missing } : { ...r, missing };
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
  type Rec = { role: string; overlapped: boolean; before?: number; after?: number; writes_refused?: number; tools_denied?: number };
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
      const out = await rt.agent(prompt, opts);
      Object.assign(rec, refusalsOf(out));
      return out;
    } finally {
      running.delete(rec);
      const after = spent();
      if (after !== undefined) rec.after = after;
    }
  };
  const agents = () =>
    recs.map((r): AgentUsage => {
      const delta = !r.overlapped && r.before !== undefined && r.after !== undefined ? r.after - r.before : undefined;
      return {
        role: r.role,
        ...(delta !== undefined && delta >= 0 ? { output_tokens: delta } : {}),
        ...(r.writes_refused !== undefined ? { writes_refused: r.writes_refused } : {}),
        ...(r.tools_denied !== undefined ? { tools_denied: r.tools_denied } : {}),
      };
    });
  return { runtime: { ...rt, agent }, agents, concurrency: () => peak };
}

/** A count an agent reported in its structured output: a non-negative whole number, else undefined. */
function count(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined;
}

/** The refusal counts (B-07) an agent's structured output reports; a missing or malformed count is left out. */
function refusalsOf(out: unknown): { writes_refused?: number; tools_denied?: number } {
  if (!out || typeof out !== "object") return {};
  const o = out as Record<string, unknown>;
  const w = count(o["writesRefused"]);
  const t = count(o["toolsDenied"]);
  return { ...(w !== undefined ? { writes_refused: w } : {}), ...(t !== undefined ? { tools_denied: t } : {}) };
}

/** A dispatch line's refusal totals: each count summed over the agents that reported it, absent when none did. */
export function refusalTotals(agents: AgentUsage[]): { writes_refused?: number; tools_denied?: number } {
  const sum = (k: "writes_refused" | "tools_denied") => {
    const xs = agents.map((a) => a[k]).filter((n): n is number => n !== undefined);
    return xs.length ? { [k]: xs.reduce((a, b) => a + b, 0) } : {};
  };
  return { ...sum("writes_refused"), ...sum("tools_denied") };
}

/** A `single`'s worker fills in its own counts on the line it writes (B-07). */
const REFUSAL_PLACEHOLDERS = { writes_refused: WRITES_REFUSED_PLACEHOLDER, tools_denied: TOOLS_DENIED_PLACEHOLDER } as unknown as { writes_refused: number; tools_denied: number };

/** The per-agent fields of a dispatch line, the detail its topology recorded (B-06) and the refusal totals (B-07). */
type AgentFields = { agents: AgentUsage[]; demand: number; concurrency: number; writes_refused?: number; tools_denied?: number } & ReturnType<typeof traceDetail>;

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
  if (demand + 2 > HARD_AGENT_LIMIT) return { id: spec.id, status: "over_budget", result: `not run: ${demand} agent(s), the artifact checker and the scribe would exceed the ${HARD_AGENT_LIMIT}-agent run limit`, artifacts: [], iterations: 0 };
  const wave = waveOf(spec.id);
  const sameWave = wave ? spec.dependsOn.find((d) => waveOf(d) === wave && d !== spec.id) : undefined;
  if (sameWave) return fail(spec, `dependsOn names ${sameWave} from the same wave; each dispatch is its own workflow and cannot wait on another: use a chain, or dispatch this next wave`);
  return null;
}

export async function runWorkflow(args: DispatchArgs, rt: Runtime): Promise<DispatchReturn> {
  const a: Partial<DispatchArgs> = args && typeof args === "object" ? args : {};
  // The start: the orchestrator's `now` if it still sends one, else a placeholder the trace's writer replaces from the clock (B-04).
  const now = typeof a.now === "string" && a.now ? a.now : START_PLACEHOLDER;
  const scratch = typeof a.scratch === "string" && a.scratch ? a.scratch : ".";
  const raw = a.dispatch;
  const spec = normaliseSpec(raw);
  const id = spec.id;
  const wave = waveOf(id);

  // Interventions since the last wave: objects are kept (stamped with the start when undated), anything else is dropped and logged.
  // An entry typed `hook` stays a hook event (A-09: a hook is never an intervention); every other object is a human one.
  const rawHumans: unknown[] = Array.isArray(a.humans) ? a.humans : [];
  const humans: Array<HumanEvent | HookEvent> = rawHumans
    .filter((h): h is HumanEvent | HookEvent => !!h && typeof h === "object")
    .map((h) => (h.type === "hook" ? { ...h, type: "hook", at: h.at ?? now } : withSource({ ...(h as HumanEvent), type: "human", at: h.at ?? now })));
  if (humans.length !== rawHumans.length) rt.log(`${id}: dropped ${rawHumans.length - humans.length} malformed humans entry(ies); each must be an object`);

  const demand = agentDemand(raw);
  rt.log(`${id}: ${String(spec.topology)}, up to ${demand} agent(s) + 1 scribe`);

  // Events: interventions, the chain stages, then the dispatch itself.
  // Every dispatch line, chain stages included, names the build that wrote it (B-03).
  const stamped = (e: TraceEvent): TraceEvent => (e.type === "dispatch" ? { ...e, version: PLUGIN_VERSION } : e);
  const linesOf = (r: DispatchResult, stages: TraceEvent[], fields: AgentFields) => [...humans, ...stages.map(stamped), stamped({ ...dispatchEvent(wave, spec, r), ...fields, at: now, ended: END_PLACEHOLDER })].map((e) => JSON.stringify(e));

  const meter = meteredRuntime(rt);
  const ctx: TopologyContext = { rt: meter.runtime, artifactDir: scratch, wave, stageEvents: [] };
  // A `single`'s worker appends the lines a done result would get, as its final step (fixes ticket 08).
  // Its own usage is not known while it writes them, so its agent carries only its role.
  if (raw && typeof raw === "object" && spec.topology === "single" && id !== "?") {
    ctx.selfTrace = { id, file: traceFileOf(scratch, id), argsFile: argsFileOf(scratch, id), lines: linesOf({ id, status: "done", result: "", artifacts: [], iterations: 1 }, [], { agents: [{ role: "worker" }], demand, concurrency: 1, ...REFUSAL_PLACEHOLDERS }) };
  }
  let result: DispatchResult;
  if (!raw || typeof raw !== "object") result = fail({ id: "?" }, "args.dispatch is not a dispatch spec");
  else result = refusal(spec, demand) ?? (await runDispatch(ctx, raw));
  result = await checkArtifacts(rt, raw && typeof raw === "object" ? spec : null, result);

  const traceFile = traceFileOf(scratch, result.id !== "?" ? result.id : id);
  // Cuts that dropped lines are logged, and counted on the dispatch line (B-06).
  const dropped = ctx.dropped ?? 0;
  if (dropped > 0) rt.log(`${id}: cuts dropped ${dropped} line(s)`);
  const agents = meter.agents();
  const refusals = refusalTotals(agents);
  if (Object.keys(refusals).length) rt.log(`${id}: ${refusals.writes_refused ?? "?"} write(s) refused, ${refusals.tools_denied ?? "?"} tool(s) denied`);
  const fields: AgentFields = { agents, demand, concurrency: meter.concurrency(), ...traceDetail(ctx, id, dropped), ...refusals };
  const lines = linesOf(result, ctx.stageEvents, fields);

  // The worker wrote the lines: no scribe, provided what it wrote is what the result's lines are (its usage and the
  // count its result's cut dropped aside, which it could not know; the log line above records that count). Its
  // refusal counts it filled in itself from the placeholders.
  const self = ctx.selfTrace;
  if (self && (self.appended ?? 0) > 0) {
    const { dropped: _cut, writes_refused: _w, tools_denied: _t, ...unknowable } = fields;
    const rolesOnly = linesOf(result, ctx.stageEvents, { ...unknowable, agents: fields.agents.map((a) => ({ role: a.role })), ...REFUSAL_PLACEHOLDERS });
    if (self.lines.join("\n") === rolesOnly.join("\n")) {
      if (self.appended !== rolesOnly.length) rt.log(`${id}: worker reported ${self.appended} trace line(s) appended, expected ${rolesOnly.length}`);
      rt.log(`STATUS ${result.status}`);
      return { ...result, ...(spec.title ? { title: spec.title } : {}), version: PLUGIN_VERSION, scribe: { appended: self.appended ?? 0, totalLines: self.totalLines ?? 0 }, tracedBy: "worker" };
    }
    rt.log(`${id}: worker appended ${self.appended} trace line(s) but the dispatch is ${result.status}; the scribe appends the true line(s)`);
  }

  // The scribe: one agent, one write. A throw here must not lose the result.
  const scribeLabel = agentLabel({ role: "scribe", task: "logging current dispatch" });
  let scribe: DispatchReturn["scribe"] = null;
  try {
    const out = await rt.agent(scribePrompt(traceFile, lines, argsFileOf(scratch, result.id !== "?" ? result.id : id)), { label: scribeLabel, schema: SCRIBE_SCHEMA, ...modelOpt(raw && typeof raw === "object" ? spec : null, "scribe") });
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
  return { ...result, ...(spec.title ? { title: spec.title } : {}), version: PLUGIN_VERSION, scribe, ...(scribe ? { tracedBy: "scribe" as const } : {}) };
}
