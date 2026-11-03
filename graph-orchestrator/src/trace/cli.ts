/**
 * render-trace: the one shell command the orchestrator runs, at session end.
 *
 *   node scripts/render-trace.js <trace-dir | trace.jsonl> [--out <file.mmd>] [--human '<json>']...
 *
 * The trace is a directory with one <dispatch-id>.jsonl per dispatch (what
 * the dispatch workflows write), or a single JSONL file (a v0.2 trace). A
 * directory's files are read in dispatch order: by wave, then dispatch number.
 * Prints the Mermaid diagram to stdout and writes it beside the trace
 * (<trace>.mmd by default). Each --human event is appended first (to
 * <trace-dir>/end.jsonl for a directory), so interventions after the final
 * wave are recorded too.
 */
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { renderTrace } from "./render.ts";

const USAGE = "usage: render-trace <trace-dir | trace.jsonl> [--out <file.mmd>] [--human '<json>']...\n";

/** Sort key for a trace file name: [wave, dispatch], or Infinity for a name outside the scheme (end.jsonl sorts last). */
function orderOf(name: string): [number, number] {
  const m = /^w(\d+)-d(\d+)/.exec(name);
  return m ? [Number(m[1]), Number(m[2])] : [Infinity, Infinity];
}

function traceFilesIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort((a, b) => {
      const [wa, da] = orderOf(a);
      const [wb, db] = orderOf(b);
      return wa - wb || da - db || (a < b ? -1 : a > b ? 1 : 0);
    })
    .map((f) => `${dir.replace(/\/+$/, "")}/${f}`);
}

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
      process.stdout.write(USAGE);
      return 0;
    } else if (!trace) trace = a;
    else {
      process.stderr.write(`unexpected argument: ${a}\n`);
      return 2;
    }
  }
  if (!trace) {
    process.stderr.write(USAGE);
    return 2;
  }
  // Parse every --human before touching the trace: a bad one must not leave
  // the earlier ones half-written, or a retry would append them again.
  const lines: string[] = [];
  for (const h of humans) {
    try {
      const e = JSON.parse(h);
      if (!e || typeof e !== "object") throw new Error("not an object");
      lines.push(JSON.stringify({ ...e, type: "human" }) + "\n");
    } catch (err) {
      process.stderr.write(`--human: unreadable JSON (${err instanceof Error ? err.message : String(err)}): ${h}\n`);
      return 2;
    }
  }
  if (!existsSync(trace)) {
    process.stderr.write(`no trace file at ${trace}\n`);
    return 1;
  }
  const isDir = statSync(trace).isDirectory();
  const base = trace.replace(/\/+$/, "");
  if (lines.length) appendFileSync(isDir ? `${base}/end.jsonl` : trace, lines.join(""));
  const text = isDir ? traceFilesIn(base).map((f) => readFileSync(f, "utf8").replace(/\n?$/, "\n")).join("") : readFileSync(trace, "utf8");
  const mermaid = renderTrace(text);
  const target = out || base.replace(/\.jsonl?$/, "") + ".mmd";
  writeFileSync(target, mermaid);
  process.stdout.write(mermaid);
  process.stderr.write(`wrote ${target}\n`);
  return 0;
}

process.exitCode = main(process.argv);
