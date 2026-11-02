import type { AgentOptions, DispatchSpec, Runtime } from "../src/types.ts";
import { runWave } from "../src/wave.ts";

export type Call = { prompt: string; opts: AgentOptions; n: number };

/** Script agent outputs by a substring of the call's label ("Worker", "Generator, round 2", "branch 1 of 3", "scribe"...). */
export type Script = Record<string, unknown | ((call: Call) => unknown)>;

export function fakeRuntime(script: Script = {}) {
  const calls: Call[] = [];
  const logs: string[] = [];
  const defaults: Script = {
    scribe: (c: Call) => ({ appended: c.prompt.split("\n").filter((l) => l.startsWith("{")).length, totalLines: 99 }),
    Evaluator: { pass: true, feedback: "", blocked: false },
    Partition: { subtasks: ["part a", "part b"], blocked: false },
  };
  const rt: Runtime = {
    agent: async (prompt, opts = {}) => {
      const call: Call = { prompt, opts, n: calls.length + 1 };
      calls.push(call);
      const label = opts.label ?? "";
      const merged = { ...defaults, ...script };
      // Longest matching key wins, so "Generator, round 2" beats "Generator".
      const key = Object.keys(merged)
        .filter((k) => label.includes(k))
        .sort((a, b) => b.length - a.length)[0];
      if (key === undefined) return { result: `ok: ${label}`, artifacts: [], blocked: false };
      const v = merged[key];
      return typeof v === "function" ? (v as (c: Call) => unknown)(call) : v;
    },
    parallel: async (thunks) => Promise.all(thunks.map((t) => t().catch(() => null))),
    log: (m) => logs.push(m),
  };
  return { rt, calls, logs, labels: () => calls.map((c) => c.opts.label ?? "") };
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

export const baseArgs = { now: "2026-10-30T10:00:00Z", traceFile: "/scratch/t/trace.jsonl", maxAgents: 16 };

/** Run one wave of `dispatches` against a fake runtime scripted by `script`; returns the wave and the fake's calls, logs and labels. */
export function wave(dispatches: DispatchSpec[], script: Script = {}, extra: Record<string, unknown> = {}) {
  const f = fakeRuntime(script);
  return runWave({ ...baseArgs, dispatches, ...extra }, f.rt).then((out) => ({ out, ...f }));
}
