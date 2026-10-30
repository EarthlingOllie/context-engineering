/**
 * render-trace: the one shell command the orchestrator runs, at session end.
 *
 *   node scripts/render-trace.js <trace.jsonl> [--out <file.mmd>] [--human '<json>']...
 *
 * Prints the Mermaid diagram to stdout and writes it beside the trace
 * (<trace>.mmd by default). Each --human event is appended to the trace file
 * first, so interventions after the final wave are recorded too.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { renderTrace } from "./render.ts";
import type { TraceEvent } from "../types.ts";

function main(argv: string[]): number {
  const args = argv.slice(2);
  let trace = "";
  let out = "";
  const humans: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--out") out = args[++i] ?? "";
    else if (a === "--human") humans.push(args[++i] ?? "");
    else if (a === "-h" || a === "--help") {
      process.stdout.write("usage: render-trace <trace.jsonl> [--out <file.mmd>] [--human '<json>']...\n");
      return 0;
    } else if (!trace) trace = a;
    else {
      process.stderr.write(`unexpected argument: ${a}\n`);
      return 2;
    }
  }
  if (!trace) {
    process.stderr.write("usage: render-trace <trace.jsonl> [--out <file.mmd>] [--human '<json>']...\n");
    return 2;
  }
  const extra: TraceEvent[] = [];
  for (const h of humans) {
    try {
      const e = JSON.parse(h);
      if (!e || typeof e !== "object") throw new Error("not an object");
      const ev = { ...e, type: "human" } as TraceEvent;
      extra.push(ev);
      appendFileSync(trace, JSON.stringify(ev) + "\n");
    } catch (err) {
      process.stderr.write(`--human: unreadable JSON (${err instanceof Error ? err.message : String(err)}): ${h}\n`);
      return 2;
    }
  }
  if (!existsSync(trace)) {
    process.stderr.write(`no trace file at ${trace}\n`);
    return 1;
  }
  const mermaid = renderTrace(readFileSync(trace, "utf8"));
  const target = out || trace.replace(/\.jsonl?$/, "") + ".mmd";
  writeFileSync(target, mermaid);
  process.stdout.write(mermaid);
  process.stderr.write(`wrote ${target}\n`);
  return 0;
}

process.exitCode = main(process.argv);
