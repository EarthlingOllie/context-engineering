// debate: the topology's own tests (spec story 42; design-specs.md "debate").
import { test } from "node:test";
import assert from "node:assert/strict";
import { agentDemand } from "../src/topologies.ts";
import { type Call, spec, wave, roleOf } from "./helpers.ts";

const two = [{ name: "check", stance: "an evaluator done-check is better" }, { name: "flag", stance: "a worker completion flag is better" }];

/** Each debater says who it is and which round, read back from its label ("Debater check (round 2 of 2)"; a one-round debate shows no round). */
const echo = (c: Call) => {
  const m = /Debater ([^\s:(]+)(?: \(round (\d+))?/.exec(c.opts.label ?? "")!;
  return { position: `${m[1]} argues in round ${m[2] ?? 1}`, blocked: false };
};
const verdict = { verdict: "check wins", reasoning: "contract stability\nsecond line", artifacts: ["/a/verdict.md"], blocked: false };

test("debate: runs every round with all debaters in parallel, then the judge; the judge's verdict comes back done", async () => {
  const { out, roles } = await wave(
    [spec({ id: "w1-d1", topology: "debate", roles: { judge: { instructions: "weigh stability" } }, params: { participants: two, rounds: 2 } })],
    { Debater: echo, Judge: verdict },
  );
  assert.deepEqual(roles(), ["Debater check (round 1 of 2)", "Debater flag (round 1 of 2)", "Debater check (round 2 of 2)", "Debater flag (round 2 of 2)", "Judge", "Trace scribe"]);
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 2);
  assert.equal(r.result, "check wins\n-- decisive: contract stability");
  assert.deepEqual(r.artifacts, ["/a/verdict.md"]);
});

test("debate: each debater sees its own stance and name; from round 2 every participant's prior position (all-to-all)", async () => {
  const { calls } = await wave(
    [spec({ id: "w1-d1", topology: "debate", roles: { judge: { instructions: "j" } }, params: { participants: two, rounds: 2 } })],
    { Debater: echo, Judge: verdict },
  );
  const byLabel = (l: string) => calls.find((c) => roleOf(c.opts.label).startsWith(l))!.prompt;
  const r1 = byLabel("Debater flag (round 1");
  assert.match(r1, /ROLE: debater/);
  assert.match(r1, /STANCE:\na worker completion flag is better/);
  assert.match(r1, /YOU ARE:\nflag/);
  assert.doesNotMatch(r1, /PRIOR ROUND \(round/);
  const r2 = byLabel("Debater flag (round 2");
  assert.match(r2, /PRIOR ROUND \(round 1\):\n\[check\] check argues in round 1\n\[flag\] flag argues in round 1/);
  assert.doesNotMatch(r2, /argues in round 2/);
  const judge = byLabel("Judge");
  assert.match(judge, /ROLE: judge/);
  assert.match(judge, /PARTICIPANTS:\n\[check\] an evaluator done-check is better\n\[flag\] a worker completion flag is better/);
  assert.match(judge, /TRANSCRIPT:\nROUND 1\n\[check\] check argues in round 1\n\[flag\] flag argues in round 1\nROUND 2\n\[check\] check argues in round 2\n\[flag\] flag argues in round 2/);
  assert.match(judge, /RETURN: at most 5 lines — one verdict line/);
});

test("debate: rounds default to 2; the judge may come from params.judge; no decisive line when maxLines leaves no room", async () => {
  const { out, roles } = await wave(
    [spec({ id: "w1-d1", topology: "debate", returns: { shape: "verdict", maxLines: 1 }, params: { participants: [...two, { name: "third", stance: "neither" }], judge: { instructions: "decide" } } })],
    { Debater: echo, Judge: { ...verdict, verdict: "check wins\nextra line" } },
  );
  assert.equal(roles().filter((l) => l.includes("Debater")).length, 6);
  assert.equal(roles().filter((l) => l.includes("Judge")).length, 1);
  assert.equal(out.results[0]!.status, "done");
  assert.equal(out.results[0]!.result, "check wins");
});

test("debate: a debater that blocks stops the debate with its question; no later round, no judge", async () => {
  const { out, roles } = await wave(
    [spec({ id: "w1-d1", topology: "debate", roles: { judge: { instructions: "j" } }, params: { participants: two, rounds: 3 } })],
    { Debater: echo, "Debater flag (round 1": { position: "", blocked: true, question: "which repo?" }, Judge: verdict },
  );
  assert.deepEqual(roles(), ["Debater check (round 1 of 3)", "Debater flag (round 1 of 3)", "Trace scribe"]);
  assert.equal(out.results[0]!.status, "blocked");
  assert.equal(out.results[0]!.question, "debater flag: which repo?");
  assert.equal(out.results[0]!.iterations, 1);
});

test("debate: a judge that blocks returns blocked with its question", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "debate", roles: { judge: { instructions: "j" } }, params: { participants: two, rounds: 1 } })],
    { Debater: echo, Judge: { verdict: "", reasoning: "", artifacts: [], blocked: true, question: "which matters more?" } },
  );
  assert.equal(out.results[0]!.status, "blocked");
  assert.equal(out.results[0]!.question, "which matters more?");
});

test("debate: a debater that returns nothing (or an empty position) fails the dispatch; so does a judge that returns nothing", async () => {
  const d = (id: string) => spec({ id, topology: "debate", roles: { judge: { instructions: "j" } }, params: { participants: two, rounds: 2 } });
  const { out, calls } = await wave([d("w1-d1"), d("w1-d2"), d("w1-d3")], {
    Debater: echo,
    "w1-d1 Debater check (round 2": null,
    "w1-d2 Debater flag (round 1": { position: "   ", blocked: false },
    Judge: verdict,
    "w1-d3 Judge": null,
  });
  assert.deepEqual(out.results.map((r) => r.status), ["failed", "failed", "failed"]);
  assert.match(out.results[0]!.result, /check returned nothing in round 2/);
  assert.match(out.results[1]!.result, /flag returned nothing in round 1/);
  assert.match(out.results[2]!.result, /judge returned nothing/);
  const ran = (dispatch: string, label: string) => calls.some((c) => c.dispatch === dispatch && roleOf(c.opts.label) === label);
  assert.ok(!ran("w1-d1", "Judge") && !ran("w1-d2", "Judge"));
  assert.ok(!ran("w1-d2", "Debater check (round 2 of 2)"));
});

test("debate: over_budget above 6 participants or 4 rounds; malformed params fail; neither spends an agent", async () => {
  const { out, roles } = await wave([
    spec({ id: "w1-d1", topology: "debate", params: { participants: two, rounds: 5, judge: { instructions: "j" } } }),
    spec({ id: "w1-d2", topology: "debate", params: { participants: Array.from({ length: 7 }, (_, i) => ({ name: `p${i}`, stance: "s" })), judge: { instructions: "j" } } }),
    spec({ id: "w1-d3", topology: "debate", params: { participants: two } }),
    spec({ id: "w1-d4", topology: "debate", params: { participants: [two[0], two[0]], judge: { instructions: "j" } } }),
    spec({ id: "w1-d5", topology: "debate", params: { participants: [two[0]], judge: { instructions: "j" } } }),
    spec({ id: "w1-d6", topology: "debate", params: { participants: [two[0], { name: "x", stance: " " }], judge: { instructions: "j" } } }),
    spec({ id: "w1-d7", topology: "debate", params: { participants: two, rounds: 0, judge: { instructions: "j" } } }),
  ]);
  assert.deepEqual(roles().filter((l) => l !== "Trace scribe"), [], "no role agent runs");
  assert.deepEqual(out.results.map((r) => r.status), ["over_budget", "over_budget", "failed", "failed", "failed", "failed", "failed"]);
  assert.match(out.results[0]!.result, /cap of 4/);
  assert.match(out.results[1]!.result, /cap of 6/);
  assert.match(out.results[2]!.result, /judge is required/);
  assert.match(out.results[3]!.result, /duplicate/);
});

test("debate: demand is participants × rounds + 1, and 0 when a cap would refuse the spec", () => {
  const d = (params: Record<string, unknown>) => agentDemand(spec({ id: "x", topology: "debate", params }));
  assert.equal(d({ participants: [{}, {}, {}] }), 7);
  assert.equal(d({ participants: Array.from({ length: 6 }, () => ({})), rounds: 4 }), 25);
  assert.equal(d({ participants: [{}, {}], rounds: 5 }), 0);
  assert.equal(d({ participants: Array.from({ length: 7 }, () => ({})) }), 0);
});

test("debate: blocked beats empty in the same round, and every blocked debater's question is kept", async () => {
  const three = [...two, { name: "third", stance: "neither" }];
  const { out, roles } = await wave(
    [spec({ id: "w1-d1", topology: "debate", roles: { judge: { instructions: "j" } }, params: { participants: three, rounds: 1 } })],
    {
      "Debater check:": { position: "", blocked: false },
      "Debater flag:": { position: "", blocked: true, question: "which repo?" },
      "Debater third:": { position: "", blocked: true, question: "which branch?" },
      Judge: verdict,
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.question, "debater flag: which repo?\ndebater third: which branch?");
  assert.ok(roles().includes("Debater flag"), "one round: no (round 1 of 1)");
});
