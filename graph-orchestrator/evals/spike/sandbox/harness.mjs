// Spike harness (ticket 01, throwaway): runs the shipped dispatch bundle the way
// the Workflow harness does (meta literal split off, body run as an async
// function over the harness globals) with a real Runtime backed by the Claude
// Agent SDK. Inside the Inspect sandbox, ANTHROPIC_BASE_URL points at the
// sandbox agent bridge (http://localhost:13131), so every model call is an
// Inspect model call.
//
//   node harness.mjs --bundle /opt/plugin/workflows/dispatch.js --args args.json \
//     --out result.json [--cap 2] [--model claude-opus-5-5] [--skills /opt/skills]
//     [--cwd /work] [--probe-models claude-haiku-5-5,claude-undeclared-x] [--stub]
//
// --stub replaces the engine with canned answers (and a scribe that really
// writes the trace file) so the harness can be dry-run without a model call.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({
  options: {
    bundle: { type: "string" },
    args: { type: "string" },
    out: { type: "string" },
    cap: { type: "string", default: "2" },
    model: { type: "string", default: "claude-opus-5-5" },
    skills: { type: "string", default: "/opt/skills" },
    cwd: { type: "string", default: process.cwd() },
    "probe-models": { type: "string", default: "" },
    stub: { type: "boolean", default: false },
  },
});
for (const k of ["bundle", "args", "out"]) if (!opt[k]) throw new Error(`--${k} is required`);

const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);
const logs = [];
const agents = [];
const log = (m) => { logs.push({ at: ms(), m: String(m) }); console.error(`[log] ${m}`); };

function splitScript(src) {
  if (!src.startsWith("export const meta = {")) throw new Error("bundle does not begin with the meta literal");
  const end = src.indexOf("\n}\n");
  const meta = new Function(`return (${src.slice("export const meta = ".length, end + 2)});`)();
  return { meta, body: src.slice(end + 3) };
}

// ---- engine: one Claude Code run per agent() call ----
let query = null;
if (!opt.stub) ({ query } = await import("@anthropic-ai/claude-agent-sdk"));

async function runEngine(prompt, o, rec) {
  const options = {
    model: o.model ?? opt.model,
    cwd: opt.cwd,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    settingSources: [],
    plugins: [{ type: "local", path: opt.skills }],
    env: { ...process.env },
    ...(o.schema ? { outputFormat: { type: "json_schema", schema: o.schema } } : {}),
  };
  let final = null;
  for await (const msg of query({ prompt, options })) {
    if (msg.type === "system" && msg.subtype === "init") {
      rec.init = { model: msg.model, skills: msg.skills ?? null, plugins: msg.plugins ?? null, claude_code_version: msg.claude_code_version ?? null };
      log(`engine up: ${rec.label} model=${msg.model} skills=${JSON.stringify(msg.skills ?? [])}`);
    } else if (msg.type === "assistant") {
      const m = msg.message ?? {};
      rec.calls.push({ model: m.model ?? null, usage: m.usage ?? null });
      for (const b of m.content ?? []) if (b.type === "tool_use" && b.name === "Skill") rec.skillsInvoked.push(b.input?.skill ?? b.input?.command ?? JSON.stringify(b.input));
    } else if (msg.type === "result") {
      final = msg;
    }
  }
  if (!final) throw new Error("engine ended without a result message");
  rec.result = { subtype: final.subtype, is_error: final.is_error, total_cost_usd: final.total_cost_usd, usage: final.usage, modelUsage: final.modelUsage, num_turns: final.num_turns };
  if (final.subtype !== "success") throw new Error(`engine result ${final.subtype}`);
  if (o.schema) return final.structured_output ?? JSON.parse(final.result);
  return final.result;
}

function runStub(prompt, o) {
  const label = o.label ?? "";
  if (prompt.startsWith("ROLE: scribe")) {
    const file = /to the file (.+?), exactly as given/.exec(prompt)[1];
    const lines = prompt.slice(prompt.indexOf("<<<TRACE\n") + 9, prompt.indexOf("\nTRACE>>>")).split("\n");
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, lines.map((l) => l + "\n").join(""));
    const total = readFileSync(file, "utf8").split("\n").filter(Boolean).length;
    return { appended: lines.length, totalLines: total };
  }
  if (/Evaluator/.test(label)) return { pass: true, feedback: "", blocked: false };
  return { result: "stub: no model call was made", artifacts: [], blocked: false };
}

// ---- Runtime ----
let seq = 0;
async function agent(prompt, o = {}) {
  const rec = { n: ++seq, label: o.label ?? null, requestedModel: o.model ?? opt.model, start: ms(), end: null, calls: [], skillsInvoked: [], init: null, result: null, error: null };
  agents.push(rec);
  try {
    return opt.stub ? runStub(prompt, o) : await runEngine(prompt, o, rec);
  } catch (e) {
    rec.error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    rec.end = ms();
  }
}

// parallel: at most `cap` thunks at once; queue time recorded per thunk.
const cap = Math.max(1, Number(opt.cap) || 2);
const queue = [];
async function parallel(thunks) {
  let next = 0;
  const out = new Array(thunks.length).fill(null);
  const enq = ms();
  async function lane() {
    while (next < thunks.length) {
      const i = next++;
      const started = ms();
      queue.push({ index: i, queuedMs: started - enq });
      try { out[i] = await thunks[i](); } catch (e) { log(`parallel thunk ${i} threw: ${e instanceof Error ? e.message : e}`); out[i] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(cap, thunks.length) }, lane));
  return out;
}

// ---- run ----
const { meta, body } = splitScript(readFileSync(opt.bundle, "utf8"));
const args = JSON.parse(readFileSync(opt.args, "utf8"));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction("agent", "parallel", "log", "phase", "pipeline", "workflow", "budget", "args", body);

let ret = null, error = null;
try {
  ret = await run(agent, parallel, log, () => {}, () => {}, () => { throw new Error("nested workflow() is not supported by the spike harness"); }, { total: null }, args);
} catch (e) {
  error = e instanceof Error ? e.stack : String(e);
}

// Condition 3 probe: the same tiny task under other model names. Each name is
// sent as the request's model; the Inspect log shows which model served it.
const probes = [];
for (const name of opt["probe-models"].split(",").map((s) => s.trim()).filter(Boolean)) {
  try {
    const r = await agent(`Reply with the single word: ok`, { label: `Probe: ${name}`, model: name });
    probes.push({ requested: name, reply: r });
  } catch (e) {
    probes.push({ requested: name, error: e instanceof Error ? e.message : String(e) });
  }
}

const result = { meta: { name: meta.name }, stub: opt.stub, cap, mainModel: opt.model, wallClockMs: ms(), return: ret, error, agents, queue, probes, logs };
mkdirSync(dirname(opt.out), { recursive: true });
writeFileSync(opt.out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: ret?.status ?? "error", wallClockMs: result.wallClockMs, agents: agents.length, out: opt.out }));
process.exit(error ? 1 : 0);
