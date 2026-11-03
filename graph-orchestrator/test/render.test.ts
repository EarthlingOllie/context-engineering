import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { renderTrace, parseTrace } from "../src/trace/render.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const lines = (s: string) => s.split("\n").map((l) => l.trim());

test("single wave: one subgraph, a node per dispatch labelled with topology and iterations, status as class", () => {
  const out = renderTrace(fixture("single-wave.jsonl"));
  const L = lines(out);
  assert.equal(L[0], "flowchart TD");
  assert.ok(L.includes('subgraph wave1["Wave 1 · 2026-10-30T10:00:00Z · 1 done · 1 exhausted"]'));
  assert.ok(L.includes('w1_d1["w1-d1<br/>single ×1"]:::done'));
  assert.ok(L.includes('w1_d2["w1-d2<br/>generator-evaluator ×3<br/>exhausted"]:::exhausted'));
  assert.equal(L.filter((l) => l === "end").length, 1);
  assert.ok(L.some((l) => l.startsWith("classDef done ")));
  assert.ok(L.some((l) => l.startsWith("classDef blocked ")));
  assert.ok(!out.includes("-->"), "no edges without dependencies");
});

test("status counts: the subgraph title carries the wave's non-zero status counts, from wave_end in a v0.2 trace, else counted from its dispatches", () => {
  const L = lines(renderTrace(fixture("single-wave.jsonl")));
  assert.ok(L.includes('subgraph wave1["Wave 1 · 2026-10-30T10:00:00Z · 1 done · 1 exhausted"]'));
  const open = fixture("single-wave.jsonl").split("\n").filter((l) => !l.includes('"wave_end"')).join("\n");
  assert.ok(lines(renderTrace(open)).includes('subgraph wave1["Wave 1 · 2026-10-30T10:00:00Z · 1 done · 1 exhausted"]'), "counted from the dispatches without a wave_end line");
  assert.equal(parseTrace(open).skipped, 0);
});

test("multiple waves with dependencies: dependsOn edges across waves, chain stages nested, unknown deps noted", () => {
  const out = renderTrace(fixture("multi-wave-deps.jsonl"));
  const L = lines(out);
  assert.ok(L.includes('subgraph wave1["Wave 1 · 2026-10-30T10:00:00Z · 2 done"]'));
  assert.ok(L.includes('subgraph wave2["Wave 2 · 2026-10-30T10:20:00Z · 1 done · 1 failed"]'));
  assert.ok(L.includes('subgraph w2_d1["w2-d1 · chain ×2"]'));
  assert.ok(L.includes('w2_s1["w2-s1<br/>single ×1"]:::done'));
  assert.ok(L.includes('w2_s2["w2-s2<br/>generator-evaluator ×2"]:::done'));
  assert.ok(L.includes("w2_s1 --> w2_s2"));
  assert.ok(L.includes("class w2_d1 done"));
  assert.ok(L.includes("w1_d1 --> w2_d1"));
  assert.ok(L.includes("w1_d2 --> w2_d1"));
  assert.ok(L.includes("w1_d2 --> w2_d2"));
  assert.ok(L.includes('w2_d2["w2-d2<br/>debate ×0<br/>failed"]:::failed'));
  assert.ok(L.includes("%% w2-d2 depends on unknown w0-ghost"));
  assert.ok(out.indexOf("subgraph wave1") < out.indexOf("subgraph wave2"));
  // wave 3: a chain whose first stage is itself a chain; nested stages are drawn, not just traced
  assert.ok(L.includes('subgraph w3_d1["w3-d1 · chain ×2 · blocked"]'));
  assert.ok(L.includes('subgraph w3_s1["w3-s1 · chain ×2"]'));
  assert.ok(L.includes('w3_i1["w3-i1<br/>single ×1"]:::done'));
  assert.ok(L.includes("w3_i1 --> w3_i2"));
  assert.ok(L.includes("w3_s1 --> w3_s2"));
  assert.ok(L.includes('w3_s2["w3-s2<br/>single ×1<br/>blocked<br/>? Publish?"]:::blocked'));
  assert.ok(L.includes("class w3_s1 done"));
  assert.ok(L.includes("class w3_d1 blocked"));
  assert.ok(L.includes("w2_d1 --> w3_d1"));
  assert.ok(out.indexOf("subgraph w3_s1") > out.indexOf("subgraph w3_d1") && out.indexOf("subgraph w3_s1") < out.indexOf("class w3_d1"));
});

test("blocked then resumed: the human node hangs off the blocked dispatch and dots into the re-dispatch; labels are escaped", () => {
  const out = renderTrace(fixture("blocked-resumed.jsonl"));
  const L = lines(out);
  assert.ok(L.includes('w1_d2["w1-d2<br/>single ×1<br/>blocked<br/>? Which database: #quot;postgres#quot; or #lt;sqlite#gt;?"]:::blocked'));
  assert.ok(L.includes('human_1(["human · blocked<br/>on w1-d2<br/>Which database: #quot;postgres#quot; or #lt;sqlite#gt;?<br/>→ postgres"]):::human'));
  assert.ok(L.includes("w1_d2 --> human_1"));
  assert.ok(L.includes("w1_d2 --> w2_d1"));
  assert.ok(L.includes("human_1 -.-> w2_d1"));
  assert.ok(out.indexOf("subgraph wave1") < out.indexOf("human_1([") && out.indexOf("human_1([") < out.indexOf("subgraph wave2"), "human sits between the waves");
  assert.ok(!out.includes('"<'), "no raw angle brackets inside labels");
});

test("human interventions without a dispatch render as standalone nodes; unreadable lines are skipped and counted", () => {
  const out = renderTrace(fixture("human-intervention.jsonl"));
  const L = lines(out);
  assert.ok(L.includes('human_1(["human · ambiguity<br/>Rewrite or wrap the legacy parser?<br/>→ wrap it"]):::human'));
  assert.ok(L.includes('human_2(["human · budget<br/>Wave budget of 16 reached; continue?<br/>→ stop"]):::human'));
  assert.ok(L.includes('w1_d1["w1-d1<br/>single ×1<br/>over budget"]:::over_budget'));
  assert.ok(L.includes("%% 1 unreadable line(s) skipped"));
  assert.ok(out.indexOf("human_1([") < out.indexOf("subgraph wave1") && out.indexOf("subgraph wave1") < out.indexOf("human_2(["));
  assert.equal(parseTrace(fixture("human-intervention.jsonl")).skipped, 1);
});

test("an intervention only dots into dispatches that come after it; a same-wave dispatch that ran before it gets no edge (UC3 trace)", () => {
  const out = renderTrace(fixture("uc3-release.jsonl"));
  const L = lines(out);
  assert.ok(L.includes("human_1 -.-> w2_d1"), "the resumed changelog dispatch follows the blocked intervention");
  assert.ok(!L.includes("human_3 -.-> w3_d2"), "w3-d2 ran in the same wave as w3-d1, before the exhaustion intervention existed");
  assert.ok(L.includes("w3_d1 --> human_3"));
  assert.ok(L.includes("w3_d1 --> w3_d2"));
  assert.ok(L.includes('w3_d2["w3-d2<br/>single ×0<br/>failed"]:::failed'), "the short-circuited dependant shows zero iterations");
  assert.equal(L.filter((l) => /^human_\d+\(\[/.test(l)).length, 4, "four intervention nodes");
});

test("extra events (the CLI's --human) are rendered after the file's events", () => {
  const out = renderTrace(fixture("single-wave.jsonl"), [{ type: "human", trigger: "exhausted", dispatch: "w1-d2", question: "Three rounds failed; stop?", answer: "yes" }]);
  assert.ok(lines(out).includes("w1_d2 --> human_1"));
});

test("the CLI appends --human lines to the trace, writes the .mmd beside it and prints the diagram", () => {
  const dir = mkdtempSync(join(tmpdir(), "go-render-"));
  const trace = join(dir, "trace.jsonl");
  writeFileSync(trace, fixture("single-wave.jsonl"));
  const cli = new URL("../scripts/render-trace.js", import.meta.url).pathname;
  const human = JSON.stringify({ at: "2026-10-30T11:00:00Z", trigger: "exhausted", dispatch: "w1-d2", question: "Stop?", answer: "yes" });
  const stdout = execFileSync("node", [cli, trace, "--human", human], { encoding: "utf8" });
  assert.match(stdout, /^flowchart TD/);
  assert.ok(existsSync(join(dir, "trace.mmd")));
  assert.equal(readFileSync(join(dir, "trace.mmd"), "utf8"), stdout);
  const appended = readFileSync(trace, "utf8").trim().split("\n").at(-1)!;
  assert.deepEqual(JSON.parse(appended), { ...JSON.parse(human), type: "human" });
  assert.match(stdout, /w1_d2 --> human_1/);
  const custom = execFileSync("node", [cli, trace, "--out", join(dir, "session.mmd")], { encoding: "utf8" });
  assert.ok(existsSync(join(dir, "session.mmd")));
  assert.match(custom, /human_1\(\[/, "the appended human line is now part of the trace");
});

test("the CLI validates every --human before writing: a bad one leaves the trace untouched, so a retry appends no duplicates", () => {
  const dir = mkdtempSync(join(tmpdir(), "go-render-"));
  const trace = join(dir, "trace.jsonl");
  writeFileSync(trace, fixture("single-wave.jsonl"));
  const before = readFileSync(trace, "utf8");
  const cli = new URL("../scripts/render-trace.js", import.meta.url).pathname;
  const good = JSON.stringify({ at: "2026-10-30T11:00:00Z", trigger: "exhausted", dispatch: "w1-d2", question: "Stop?", answer: "yes" });
  assert.throws(
    () => execFileSync("node", [cli, trace, "--human", good, "--human", "{not json"], { encoding: "utf8", stdio: "pipe" }),
    (err: { status?: number; stderr?: string }) => err.status === 2 && /--human: unreadable JSON/.test(err.stderr ?? ""),
  );
  assert.equal(readFileSync(trace, "utf8"), before, "nothing appended when a later --human is unreadable");
  assert.ok(!existsSync(join(dir, "trace.mmd")), "nothing rendered either");
  execFileSync("node", [cli, trace, "--human", good], { encoding: "utf8" });
  const humans = readFileSync(trace, "utf8").trim().split("\n").filter((l) => l.includes('"type":"human"'));
  assert.equal(humans.length, 1, "the retry appends the human line exactly once");
});

test("malformed dispatch and human lines: without id and status, or trigger and question, they are skipped and counted; other missing fields default", () => {
  const out = renderTrace(fixture("malformed-lines.jsonl"));
  const L = lines(out);
  assert.ok(L.includes('subgraph wave1["Wave 1 · 2026-10-30T10:00:00Z · 1 done"]'));
  assert.ok(L.includes('w1_d4["w1-d4<br/>unknown ×0"]:::done'), "topology, iterations, dependsOn, stages and question default when absent or mistyped");
  assert.ok(!L.some((l) => l.startsWith("w1_d1[") || l.startsWith("w1_d3[") || l.startsWith("undefined[")), "a dispatch without id or status draws no node");
  assert.ok(L.includes('human_1(["human · blocked<br/>on w1-d4<br/>Continue?"]):::human'), "a missing answer defaults to none");
  assert.ok(!L.some((l) => l.startsWith("human_2(")), "a human without trigger or question draws no node");
  assert.ok(L.includes("w1_d4 --> human_1"));
  assert.ok(!out.includes("undefined"));
  assert.ok(L.includes("%% 5 unreadable line(s) skipped"));
  assert.equal(parseTrace(fixture("malformed-lines.jsonl")).skipped, 5);
});

// ---------- per-dispatch traces: one file per dispatch workflow ----------

const perDispatch: Record<string, string> = {
  "w1-d1.jsonl": JSON.stringify({ type: "dispatch", wave: 1, id: "w1-d1", title: "Map the HTTP client", at: "2026-11-03T09:00:00Z", topology: "single", iterations: 1, status: "done", dependsOn: [] }),
  "w1-d2.jsonl": JSON.stringify({ type: "dispatch", wave: 1, id: "w1-d2", title: "Survey retry libraries", at: "2026-11-03T09:00:00Z", topology: "fan-out", iterations: 1, status: "blocked", dependsOn: [], question: "Which licence?" }),
  "w2-d1.jsonl": [
    JSON.stringify({ type: "human", at: "2026-11-03T09:30:00Z", trigger: "blocked", dispatch: "w1-d2", question: "Which licence?", answer: "MIT only" }),
    JSON.stringify({ type: "dispatch", wave: 2, id: "w2-d1", title: "Add the retry policy", at: "2026-11-03T09:30:00Z", topology: "generator-evaluator", iterations: 2, status: "done", dependsOn: ["w1-d1", "w1-d2"] }),
  ].join("\n"),
  "w10-d1.jsonl": JSON.stringify({ type: "dispatch", wave: 10, id: "w10-d1", topology: "single", iterations: 1, status: "done", dependsOn: ["w2-d1"] }),
};

test("titles: a dispatch with a title shows it first, then its id, topology and iterations", () => {
  const L = lines(renderTrace(Object.values(perDispatch).join("\n")));
  assert.ok(L.includes('w1_d1["Map the HTTP client<br/>w1-d1 · single ×1"]:::done'));
  assert.ok(L.includes('w2_d1["Add the retry policy<br/>w2-d1 · generator-evaluator ×2"]:::done'));
  assert.ok(L.includes('w10_d1["w10-d1<br/>single ×1"]:::done'), "no title, the v0.2 label");
  assert.ok(L.includes('subgraph wave1["Wave 1 · 2026-11-03T09:00:00Z · 1 done · 1 blocked"]'), "time from the dispatch lines, counts from their statuses");
});

test("the CLI renders a trace directory in dispatch order (wave, then dispatch number) and writes --human to end.jsonl", () => {
  const dir = mkdtempSync(join(tmpdir(), "go-render-"));
  const trace = join(dir, "trace");
  mkdirSync(trace);
  for (const [name, text] of Object.entries(perDispatch)) writeFileSync(join(trace, name), text + "\n");
  const cli = new URL("../scripts/render-trace.js", import.meta.url).pathname;
  const human = JSON.stringify({ trigger: "budget", question: "Stop at wave 10?", answer: "yes" });
  const stdout = execFileSync("node", [cli, trace, "--out", join(dir, "session.mmd"), "--human", human], { encoding: "utf8" });
  assert.equal(readFileSync(join(dir, "session.mmd"), "utf8"), stdout);
  const order = ["subgraph wave1", "subgraph wave2", "subgraph wave10", "human_2"].map((k) => stdout.indexOf(k));
  assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1]!)), `waves in numeric order, the final intervention last: ${order}`);
  assert.match(stdout, /w1_d2 --> human_1/);
  assert.match(stdout, /human_1 -.-> w2_d1/, "the intervention links to the dispatch that resumed after it");
  assert.match(stdout, /w2_d1 --> w10_d1/);
  assert.deepEqual(JSON.parse(readFileSync(join(trace, "end.jsonl"), "utf8").trim()), { ...JSON.parse(human), type: "human" });
  execFileSync("node", [cli, trace], { encoding: "utf8" });
  assert.ok(existsSync(join(dir, "trace.mmd")), "a directory's default output sits beside it");
});
