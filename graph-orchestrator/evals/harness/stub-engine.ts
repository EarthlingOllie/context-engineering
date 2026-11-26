/**
 * The canned engine behind `main.ts --stub`: no model call is made. The
 * scribe really writes the trace lines it was given; a partition agent gets as
 * many sub-tasks as it was allowed; an evaluator passes, or with
 * `evaluator: "fail"` always fails (so a dry run reaches `exhausted`); a judge
 * picks candidate [1]; a debater holds its stance; a relay worker adds a
 * `SESSION s: stub` line to its progress file, as a real session rewrites it;
 * every other role reports nothing useful. `delayMs` makes each non-scribe answer
 * take that long, so queueing under the cap shows in a dry run.
 *
 * Each answer's record holds one call, served on the model requested, the way
 * the SDK engine records the model that served each call. `serveModel` serves
 * every call on that model whatever was requested: a dry run of the bridge's
 * silent fallback to the main model, so the routing check can be seen failing.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Engine } from "./runtime.ts";

export type StubOptions = { delayMs?: number; evaluator?: "pass" | "fail"; serveModel?: string };

export function stubEngine(o: StubOptions = {}): Engine {
  const delayMs = o.delayMs ?? 0;
  return async (req) => {
    const record = { stub: true, calls: [{ model: o.serveModel ?? req.model, usage: null }] };
    if (req.prompt.startsWith("ROLE: scribe")) {
      const file = /to the file (.+?), exactly as given/.exec(req.prompt)?.[1];
      if (!file) throw new Error("stub scribe: no trace file in the prompt");
      const lines = req.prompt.slice(req.prompt.indexOf("<<<TRACE\n") + 9, req.prompt.indexOf("\nTRACE>>>")).split("\n");
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, lines.map((l) => l + "\n").join(""));
      const totalLines = readFileSync(file, "utf8").split("\n").filter(Boolean).length;
      return { output: { appended: lines.length, totalLines }, record };
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (req.label?.startsWith("Partition")) {
      const width = Number(/at most (\d+) independent sub-tasks/.exec(req.prompt)?.[1] ?? 1);
      return { output: { subtasks: Array.from({ length: width }, (_, i) => `stub sub-task ${i + 1}`), blocked: false }, record };
    }
    if (req.label?.startsWith("Judge")) {
      return { output: { verdict: "[1] stub: no model call was made", reasoning: "stub: the first candidate", chosen: 1, artifacts: [], blocked: false }, record };
    }
    if (req.label?.startsWith("Debater")) {
      return { output: { position: "stub: no model call was made", blocked: false }, record };
    }
    const progress = /^PROGRESS: (.+):$/m.exec(req.prompt)?.[1];
    const session = /^SESSION (\d+) of \d+:$/m.exec(req.prompt)?.[1];
    if (progress && session && req.label?.startsWith("Worker")) {
      mkdirSync(dirname(progress), { recursive: true });
      appendFileSync(progress, `SESSION ${session}: stub\n`);
    }
    if (/Evaluator/.test(req.label ?? "")) {
      const pass = o.evaluator !== "fail";
      return { output: { pass, feedback: pass ? "" : "1. stub: the evaluator was set to fail", blocked: false }, record };
    }
    return { output: { result: "stub: no model call was made", artifacts: [], blocked: false }, record };
  };
}
