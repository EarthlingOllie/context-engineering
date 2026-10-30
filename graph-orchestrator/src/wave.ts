/**
 * runWave: the wave boundary. Pure over the injected runtime. Runs every
 * dispatch of the wave in parallel (a dispatch that names a same-wave id in
 * `dependsOn` waits for it and receives its artifacts, or fails unrun when
 * that dependency did not finish `done`), collects the trace
 * events in memory, and finishes by asking one scribe agent to append them to
 * the trace file in a single write.
 */
import type { DispatchResult, DispatchSpec, HumanEvent, Runtime, TraceEvent, WaveArgs, WaveReturn } from "./types.ts";
import { agentDemand, dispatchEvent, fail, firstLine, forwardLines, runDispatch, type TopologyContext } from "./topologies.ts";

/** The runtime's hard limit on agents per run. The only thing a wave refuses. */
export const HARD_AGENT_LIMIT = 1000;

export function waveNumberOf(args: Partial<WaveArgs>): number {
  const n = Number(args.wave);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  for (const d of args.dispatches ?? []) {
    const m = /^w(\d+)-/.exec(String(d?.id ?? ""));
    if (m) return Number(m[1]);
  }
  return 0;
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : ".";
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

export async function runWave(args: WaveArgs, rt: Runtime): Promise<WaveReturn> {
  const a: Partial<WaveArgs> = args && typeof args === "object" ? args : {};
  const dispatches: DispatchSpec[] = Array.isArray(a.dispatches) ? a.dispatches : [];
  const wave = waveNumberOf(a);
  const now = typeof a.now === "string" && a.now ? a.now : "unknown";
  const traceFile = typeof a.traceFile === "string" && a.traceFile ? a.traceFile : "trace.jsonl";
  const cap = Math.max(1, Math.floor(Number(a.maxAgents)) || 1);
  const artifactDir = typeof a.artifactDir === "string" && a.artifactDir ? a.artifactDir : dirOf(traceFile);

  // Demand log: the sum of each dispatch's agent need, against the effective cap. The scribe is one more, stated apart.
  const demands = dispatches.map((d) => agentDemand(d));
  const demand = demands.reduce((s, n) => s + n, 0);
  const perDispatch = dispatches.map((d, i) => `${d?.id ?? "?"}=${demands[i]}`).join(" ");
  rt.log(
    `wave ${wave}: ${dispatches.length} dispatch(es), demand ${demand} agent(s) + 1 scribe vs cap ${cap}` +
      (demand > cap ? ` — over cap; the runtime queues the excess (about ${Math.ceil(demand / cap)} slots deep), expect it to be slow, not broken` : "") +
      (perDispatch ? ` [${perDispatch}]` : ""),
  );

  // Hard check: dispatches that would push the run past the runtime limit return over_budget unrun.
  const overBudgetAt = new Set<number>();
  let cumulative = 1; // the scribe
  demands.forEach((n, i) => {
    cumulative += n;
    if (cumulative > HARD_AGENT_LIMIT) overBudgetAt.add(i);
  });
  if (overBudgetAt.size) rt.log(`wave ${wave}: ${overBudgetAt.size} dispatch(es) exceed the ${HARD_AGENT_LIMIT}-agent run limit and will not run`);

  const ctx: TopologyContext = { rt, artifactDir, wave, stageEvents: [] };

  // Same-wave dependencies: first occurrence of an id wins; a dependant waits and gets the artifacts forwarded.
  const firstIndex = new Map<string, number>();
  dispatches.forEach((d, i) => {
    const id = String(d?.id ?? "");
    if (id && !firstIndex.has(id)) firstIndex.set(id, i);
  });
  const inCycle = (start: number): boolean => {
    const seen = new Set<number>();
    const stack = [...(dispatches[start]?.dependsOn ?? []).map((id) => firstIndex.get(String(id))).filter((x): x is number => x !== undefined)];
    while (stack.length) {
      const i = stack.pop()!;
      if (i === start) return true;
      if (seen.has(i)) continue;
      seen.add(i);
      for (const id of dispatches[i]?.dependsOn ?? []) {
        const j = firstIndex.get(String(id));
        if (j !== undefined) stack.push(j);
      }
    }
    return false;
  };

  const promises = new Map<number, Promise<DispatchResult>>();
  const runOne = (i: number): Promise<DispatchResult> => {
    const existing = promises.get(i);
    if (existing) return existing;
    const d = dispatches[i]!;
    const p = (async (): Promise<DispatchResult> => {
      const id = String(d?.id ?? "");
      if (id && firstIndex.get(id) !== i) return fail(d, `duplicate dispatch id "${id}" in this wave`);
      if (overBudgetAt.has(i)) return { id: id || "?", status: "over_budget", result: `not run: the wave's cumulative demand would exceed the ${HARD_AGENT_LIMIT}-agent run limit`, artifacts: [], iterations: 0 };
      if (inCycle(i)) return fail(d, "dependsOn cycle within the wave");
      const deps = (Array.isArray(d?.dependsOn) ? d.dependsOn : []).map((x) => firstIndex.get(String(x))).filter((j): j is number => j !== undefined && j !== i);
      const depResults = await Promise.all(deps.map((j) => runOne(j)));
      // A dependency that did not finish `done` has nothing to build on: short-circuit without spending an agent; the orchestrator re-dispatches next wave.
      const notDone = depResults.find((r) => r.status !== "done");
      if (notDone) {
        const why = `dependency ${notDone.id} was ${notDone.status}: ${firstLine(notDone.result)}`;
        rt.log(`wave ${wave}: ${id || "?"}: ${why}; not run`);
        return fail(d, why);
      }
      const forwarded = depResults.flatMap(forwardLines);
      const spec: DispatchSpec = forwarded.length ? { ...d, context: [...(Array.isArray(d.context) ? d.context : []), ...forwarded] } : d;
      return runDispatch(ctx, spec);
    })();
    promises.set(i, p);
    return p;
  };

  const raw = await rt.parallel(dispatches.map((_, i) => () => runOne(i)));
  const results: DispatchResult[] = raw.map((r, i) => r ?? fail(dispatches[i] ?? { id: "?" }, "runtime returned no result for this dispatch"));

  // Events: interventions since the last wave, then the wave, its stages, its dispatches, and the end line.
  const humans: HumanEvent[] = (Array.isArray(a.humans) ? a.humans : []).map((h) => ({ ...h, type: "human", at: h.at ?? now }));
  const counts = { done: 0, blocked: 0, exhausted: 0, over_budget: 0, failed: 0 };
  for (const r of results) counts[r.status]++;
  const events: TraceEvent[] = [
    ...humans,
    { type: "wave_start", wave, at: now, dispatches: dispatches.length, demand, cap },
    ...ctx.stageEvents,
    ...results.map((r, i) => dispatchEvent(wave, dispatches[i] ?? ({ id: r.id, topology: "?", dependsOn: [] } as unknown as DispatchSpec), r)),
    { type: "wave_end", wave, at: now, ...counts },
  ];

  // The scribe: one agent, one write.
  const lines = events.map((e) => JSON.stringify(e));
  const out = await rt.agent(scribePrompt(traceFile, lines), { label: `wave ${wave} scribe`, phase: "scribe", schema: SCRIBE_SCHEMA });
  let scribe: WaveReturn["scribe"] = null;
  if (out && typeof out === "object") {
    const o = out as Record<string, unknown>;
    scribe = { appended: Number(o["appended"]) || 0, totalLines: Number(o["totalLines"]) || 0 };
    if (scribe.appended !== lines.length) rt.log(`wave ${wave}: scribe reported ${scribe.appended} line(s) appended, expected ${lines.length}`);
  } else {
    rt.log(`wave ${wave}: scribe returned nothing; trace lines for this wave were not written`);
  }

  return { status: "done", wave, results, demand, cap, events, scribe };
}
