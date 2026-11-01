// ---------- debate ----------
import type { DebateParams, DispatchResult, DispatchSpec, RoleEntry } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { DEFAULT_ROUNDS, MAX_DEBATE_ROUNDS, MAX_PARTICIPANTS, type Checked, type TopologyContext, type TopologyImpl, blockedQuestion, callRole, entryOf, contractOf, cutLines, fail, firstLine, int, overBudget, roleEntry, str, strArr } from "./shared.ts";

/** A debater's position is cut to this many lines, so a round costs at most 6 × 8 transcript lines. */
const POSITION_LINES = 8;

/** Debate params with the defaults applied and the judge resolved (params.judge or roles.judge). */
export type DebatePlan = { participants: DebateParams["participants"]; rounds: number; judge: RoleEntry };

/**
 * The param check, before any agent is spent. Caps first (`over_budget`):
 * more than 6 participants, more than 4 rounds. Then malformed (`failed`):
 * fewer than 2 participants, a missing or duplicate name, an empty stance,
 * rounds below 1, no judge.
 */
export function checkDebate(spec: DispatchSpec): Checked<DebatePlan> {
  const params = spec.params ?? {};
  const p = params["participants"];
  if (Array.isArray(p) && p.length > MAX_PARTICIPANTS) return { ok: false, result: overBudget(spec, `debate: ${p.length} participants exceeds the cap of ${MAX_PARTICIPANTS}`) };
  const rounds = int(params["rounds"], DEFAULT_ROUNDS, 0);
  if (rounds > MAX_DEBATE_ROUNDS) return { ok: false, result: overBudget(spec, `debate: ${rounds} rounds exceeds the cap of ${MAX_DEBATE_ROUNDS}`) };
  if (rounds < 1) return { ok: false, result: fail(spec, "debate: `rounds` must be at least 1") };
  if (!Array.isArray(p) || p.length < 2) return { ok: false, result: fail(spec, "debate: `participants` must list 2 to 6 { name, stance } entries") };
  const participants: DebateParams["participants"] = [];
  const seen = new Set<string>();
  for (const x of p) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const name = typeof o["name"] === "string" ? o["name"].trim() : "";
    const stance = typeof o["stance"] === "string" ? o["stance"].trim() : "";
    if (!name || !stance) return { ok: false, result: fail(spec, "debate: every participant needs a non-empty `name` and `stance`") };
    if (seen.has(name)) return { ok: false, result: fail(spec, `debate: duplicate participant name "${name}"`) };
    seen.add(name);
    participants.push({ name, stance });
  }
  const pj = params["judge"];
  const judge = roleEntry(spec, "judge") ?? entryOf(pj);
  if (!judge) return { ok: false, result: fail(spec, "debate: a judge is required (params.judge or roles.judge)") };
  return { ok: true, params: { participants, rounds, judge } };
}

/** participants × rounds + 1 (the judge); 0 when a cap would refuse the spec. */
function demandDebate(_spec: Partial<DispatchSpec>, params: Record<string, unknown>): number {
  const p = params["participants"];
  const n = Array.isArray(p) ? p.length : 0;
  const rounds = int(params["rounds"], DEFAULT_ROUNDS);
  if (n > MAX_PARTICIPANTS || rounds > MAX_DEBATE_ROUNDS) return 0;
  return n * rounds + 1;
}

/** One round as transcript lines: `[name] <position>` per participant, in participant order. */
function roundLines(round: Array<{ name: string; position: string }>): string {
  return round.map((x) => `[${x.name}] ${x.position}`).join("\n");
}

/**
 * Rounds 1..N with every debater in parallel inside a round; from round 2 each
 * sees every participant's previous position (all-to-all). A blocked debater
 * stops the debate with its question; one that returns nothing fails it. The
 * judge then reads the participants and the whole inline transcript and
 * returns the verdict, plus `-- decisive: <first reasoning line>` when the
 * contract leaves room.
 */
async function runDebate(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const checked = checkDebate(spec);
  if (!checked.ok) return checked.result;
  const { participants, rounds, judge } = checked.params;
  const returns = contractOf(spec);
  const debaterEntry = roleEntry(spec, "debater");
  const transcript: Array<Array<{ name: string; position: string }>> = [];

  for (let r = 1; r <= rounds; r++) {
    const prior = transcript[r - 2];
    const outs = await ctx.rt.parallel(
      participants.map((p) => () => {
        const sections = [
          { title: "STANCE", body: p.stance },
          { title: "YOU ARE", body: p.name },
          ...(prior ? [{ title: `PRIOR ROUND (round ${r - 1})`, body: roundLines(prior) }] : []),
        ];
        return callRole(
          ctx,
          spec,
          "debater",
          buildPrompt({ role: "debater", task: spec.task, context: spec.context, entry: debaterEntry, returns: { shape: "your position this round", maxLines: POSITION_LINES }, artifactDir: ctx.artifactDir, sections }),
          `debater ${p.name} r${r}`,
        );
      }),
    );
    // Blocked first, with every blocked debater's question; then any debater that returned nothing fails the debate.
    const read = participants.map((p, i) => {
      const out = outs[i];
      return { name: p.name, question: out ? blockedQuestion(out, "debater") : null, position: out ? cutLines(str(out, "position").trim(), POSITION_LINES) : "" };
    });
    const blocked = read.filter((x) => x.question);
    if (blocked.length) {
      return { id: spec.id, status: "blocked", result: `debater(s) ${blocked.map((x) => x.name).join(", ")} blocked in round ${r}`, artifacts: [], question: blocked.map((x) => `debater ${x.name}: ${x.question}`).join("\n"), iterations: r };
    }
    const empty = read.filter((x) => !x.position);
    if (empty.length) return fail(spec, `debate: debater ${empty.map((x) => x.name).join(", ")} returned nothing in round ${r}`, r);
    transcript.push(read.map(({ name, position }) => ({ name, position })));
  }

  const out = await callRole(
    ctx,
    spec,
    "judge",
    buildPrompt({
      role: "judge",
      task: spec.task,
      context: spec.context,
      entry: judge,
      returns,
      artifactDir: ctx.artifactDir,
      sections: [
        { title: "PARTICIPANTS", body: participants.map((p) => `[${p.name}] ${p.stance}`).join("\n") },
        { title: "TRANSCRIPT", body: transcript.map((round, i) => `ROUND ${i + 1}\n${roundLines(round)}`).join("\n") },
      ],
    }),
    "judge",
  );
  if (!out) return fail(spec, "debate: judge returned nothing", rounds);
  const artifacts = strArr(out, "artifacts");
  const q = blockedQuestion(out, "judge");
  if (q) return { id: spec.id, status: "blocked", result: "judge blocked", artifacts, question: q, iterations: rounds };
  const verdict = str(out, "verdict").trim();
  if (!verdict) return fail(spec, "debate: judge returned nothing", rounds);
  const decisive = firstLine(str(out, "reasoning").trim());
  const head = cutLines(verdict, returns.maxLines);
  const room = returns.maxLines - head.split("\n").length;
  const result = decisive && room >= 1 ? `${head}\n-- decisive: ${decisive}` : head;
  return { id: spec.id, status: "done", result, artifacts, iterations: rounds };
}

export const debate: TopologyImpl = { demand: demandDebate, run: runDebate };
