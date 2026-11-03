/**
 * runWorkflow: one dispatch, as one Workflow run. Pure over the injected
 * runtime. The orchestrator starts a wave by launching one of these per
 * dispatch, all at once, each under a wrapper that names the workflow for the
 * dispatch's purpose; they run in parallel and cannot see each other. The run
 * executes the dispatch's topology, then asks one scribe agent to write the
 * dispatch's trace lines to its own file, <scratch>/trace/<id>.jsonl, so
 * parallel dispatches never write the same file.
 */
import type { DispatchArgs, DispatchResult, DispatchReturn, DispatchSpec, HumanEvent, Runtime, TraceEvent } from "./types.ts";
import { agentLabel } from "./labels.ts";
import { agentDemand, dispatchEvent, fail, normaliseSpec, runDispatch, type TopologyContext } from "./topologies.ts";

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
  const rawHumans: unknown[] = Array.isArray(a.humans) ? a.humans : [];
  const humans: HumanEvent[] = rawHumans.filter((h): h is HumanEvent => !!h && typeof h === "object").map((h) => ({ ...h, type: "human", at: h.at ?? now }));
  if (humans.length !== rawHumans.length) rt.log(`${id}: dropped ${rawHumans.length - humans.length} malformed humans entry(ies); each must be an object`);

  const demand = agentDemand(raw);
  rt.log(`${id}: ${String(spec.topology)}, up to ${demand} agent(s) + 1 scribe`);

  const ctx: TopologyContext = { rt, artifactDir: scratch, wave, stageEvents: [] };
  let result: DispatchResult;
  if (!raw || typeof raw !== "object") result = fail({ id: "?" }, "args.dispatch is not a dispatch spec");
  else result = refusal(spec, demand) ?? (await runDispatch(ctx, raw));

  // Events: interventions, the chain stages, then the dispatch itself.
  const events: TraceEvent[] = [...humans, ...ctx.stageEvents, { ...dispatchEvent(wave, spec, result), at: now }];

  // The scribe: one agent, one write. A throw here must not lose the result.
  const traceFile = traceFileOf(scratch, result.id !== "?" ? result.id : id);
  const lines = events.map((e) => JSON.stringify(e));
  const scribeLabel = agentLabel({ role: "scribe", task: "save the trace" });
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

  return { ...result, ...(spec.title ? { title: spec.title } : {}), scribe };
}
