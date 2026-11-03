import type { AgentOptions, DispatchReturn, DispatchSpec, Runtime, TraceEvent } from "../src/types.ts";
import { runWorkflow } from "../src/run.ts";

/** One agent call; `dispatch` is the id of the dispatch workflow that made it. */
export type Call = { prompt: string; opts: AgentOptions; n: number; dispatch: string };

/**
 * Script agent outputs by a substring of "<dispatch id> <label>" ("Worker",
 * "Generator (2", "Worker (1 of 3)", "w1-d2 Judge", "Recorder"...).
 */
export type Script = Record<string, unknown | ((call: Call) => unknown)>;

/**
 * A label without its task: "Worker (2 of 3)" for "Worker (2 of 3): part b".
 * A chain stage's label also loses its link and topology: "Worker" for
 * "Link 2 · Single, Worker: x".
 */
export function roleOf(label: string | undefined): string {
  let l = label ?? "";
  if (l.startsWith("Link ") && l.includes(", ")) l = l.slice(l.indexOf(", ") + 2);
  const colon = l.indexOf(": ");
  return colon === -1 ? l : l.slice(0, colon);
}

export function fakeRuntime(script: Script = {}) {
  const calls: Call[] = [];
  const logs: string[] = [];
  const defaults: Script = {
    Recorder: (c: Call) => ({ appended: c.prompt.split("\n").filter((l) => l.startsWith("{")).length, totalLines: 99 }),
    Evaluator: { pass: true, feedback: "", blocked: false },
    Partition: { subtasks: ["part a", "part b"], blocked: false },
  };
  /** The runtime one dispatch workflow sees; its calls are recorded with the dispatch id. */
  const runtimeFor = (dispatch: string): Runtime => ({
    agent: async (prompt, opts = {}) => {
      const call: Call = { prompt, opts, n: calls.length + 1, dispatch };
      calls.push(call);
      const label = opts.label ?? "";
      const text = `${dispatch} ${label}`;
      const merged = { ...defaults, ...script };
      // Longest matching key wins, so "Generator (2" beats "Generator".
      const key = Object.keys(merged)
        .filter((k) => text.includes(k))
        .sort((a, b) => b.length - a.length)[0];
      if (key === undefined) return { result: `ok: ${label}`, artifacts: [], blocked: false };
      const v = merged[key];
      return typeof v === "function" ? (v as (c: Call) => unknown)(call) : v;
    },
    parallel: async (thunks) => Promise.all(thunks.map((t) => t().catch(() => null))),
    log: (m) => logs.push(m),
  });
  return { rt: runtimeFor(""), runtimeFor, calls, logs, labels: () => calls.map((c) => c.opts.label ?? ""), roles: () => calls.map((c) => roleOf(c.opts.label)) };
}

export function spec(over: Partial<DispatchSpec> & { id: string; topology: DispatchSpec["topology"] }): DispatchSpec {
  return {
    task: `do ${over.id}`,
    context: [],
    roles: {},
    params: {},
    returns: { shape: "one verdict line", maxLines: 5 },
    dependsOn: [],
    ...over,
  };
}

export const baseArgs = { now: "2026-10-30T10:00:00Z", scratch: "/scratch/t" };

/** The trace events a scribe prompt asks to be written. */
export function eventsOf(scribePrompt: string): TraceEvent[] {
  const m = /<<<TRACE\n([\s\S]*?)\nTRACE>>>/.exec(scribePrompt);
  return m ? m[1]!.split("\n").map((l) => JSON.parse(l) as TraceEvent) : [];
}

/**
 * Run one wave the way the orchestrator does: each dispatch as its own
 * workflow, all at once, against one fake runtime scripted by `script`.
 * `out.results` are the workflows' returns in dispatch order; `out.events`
 * every trace line their scribes were asked to write, in the same order.
 */
export async function wave(dispatches: DispatchSpec[], script: Script = {}, extra: Record<string, unknown> = {}) {
  const f = fakeRuntime(script);
  const results: DispatchReturn[] = await Promise.all(
    dispatches.map((d) => runWorkflow({ ...baseArgs, dispatch: d, ...extra } as never, f.runtimeFor(d && typeof d === "object" ? String(d.id ?? "") : ""))),
  );
  const order = dispatches.map((d) => (d && typeof d === "object" ? String(d.id ?? "") : ""));
  const scribes = f.calls.filter((c) => roleOf(c.opts.label) === "Recorder").sort((a, b) => order.indexOf(a.dispatch) - order.indexOf(b.dispatch));
  const events = scribes.flatMap((c) => eventsOf(c.prompt));
  return { out: { results, events }, ...f };
}
