/**
 * The canned engine behind `main.ts --stub`: no model call is made. The
 * scribe really writes the trace lines it was given; a partition agent gets as
 * many sub-tasks as it was allowed; an evaluator passes, or with
 * `evaluator: "fail"` always fails (so a dry run reaches `exhausted`); every
 * other role reports nothing useful. `delayMs` makes each non-scribe answer
 * take that long, so queueing under the cap shows in a dry run.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Engine } from "./runtime.ts";

export type StubOptions = { delayMs?: number; evaluator?: "pass" | "fail" };

export function stubEngine(o: StubOptions = {}): Engine {
  const delayMs = o.delayMs ?? 0;
  return async (req) => {
    if (req.prompt.startsWith("ROLE: scribe")) {
      const file = /to the file (.+?), exactly as given/.exec(req.prompt)?.[1];
      if (!file) throw new Error("stub scribe: no trace file in the prompt");
      const lines = req.prompt.slice(req.prompt.indexOf("<<<TRACE\n") + 9, req.prompt.indexOf("\nTRACE>>>")).split("\n");
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, lines.map((l) => l + "\n").join(""));
      const totalLines = readFileSync(file, "utf8").split("\n").filter(Boolean).length;
      return { output: { appended: lines.length, totalLines }, record: { stub: true } };
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (req.label?.startsWith("Partition")) {
      const width = Number(/at most (\d+) independent sub-tasks/.exec(req.prompt)?.[1] ?? 1);
      return { output: { subtasks: Array.from({ length: width }, (_, i) => `stub sub-task ${i + 1}`), blocked: false }, record: { stub: true } };
    }
    if (/Evaluator/.test(req.label ?? "")) {
      const pass = o.evaluator !== "fail";
      return { output: { pass, feedback: pass ? "" : "1. stub: the evaluator was set to fail", blocked: false }, record: { stub: true } };
    }
    return { output: { result: "stub: no model call was made", artifacts: [], blocked: false }, record: { stub: true } };
  };
}
