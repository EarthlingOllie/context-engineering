// ---------- debate ----------
import type { DebateParams, DispatchResult, DispatchSpec, RoleEntry } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { DEFAULT_ROUNDS, MAX_PARTICIPANTS, type TopologyContext, type TopologyImpl, blockedQuestion, callRole, contractOf, cutLines, fail, firstLine, int, overBudget, roleEntry, str, strArr } from "./shared.ts";

type Participant = { name: string; stance: string };

/** One debater's position in one round, as the transcript carries it forward. */
type Turn = { round: number; participant: Participant; position: string };

/** The debaters' positions get a fixed share of lines; the judge gets the dispatch's contract. */
const POSITION_LINES = 8;

function participantsOf(params: Partial<DebateParams>): Participant[] {
  const raw = Array.isArray(params.participants) ? params.participants : [];
  return raw.map((p, i) => {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    return { name: str(o, "name") || `participant ${i + 1}`, stance: str(o, "stance") };
  });
}

function judgeEntryOf(spec: DispatchSpec, params: Partial<DebateParams>): RoleEntry | undefined {
  const fromRoles = roleEntry(spec, "judge");
  if (fromRoles) return fromRoles;
  const j = params.judge;
  if (j && typeof j === "object") return { ...(j.skill ? { skill: String(j.skill) } : {}), instructions: String(j.instructions ?? "") };
  return undefined;
}

const line = (p: Participant) => `${p.name}: ${p.stance || "(no stance given)"}`;
const transcriptOf = (turns: Turn[]) => turns.map((t) => `round ${t.round} — ${t.participant.name} (${t.participant.stance}):\n${t.position}`).join("\n\n");

async function runDebate(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const params = spec.params as Partial<DebateParams>;
  const participants = participantsOf(params);
  if (participants.length > MAX_PARTICIPANTS) return overBudget(spec, `debate: ${participants.length} participants exceeds the cap of ${MAX_PARTICIPANTS}`);
  if (participants.length === 0) return fail(spec, "debate: `params.participants` must list at least one { name, stance }");
  const judgeEntry = judgeEntryOf(spec, params);
  if (!judgeEntry) return fail(spec, "debate: a judge is required; supply `params.judge` or `roles.judge`");
  const rounds = int(params.rounds, DEFAULT_ROUNDS);
  const debaterEntry = roleEntry(spec, "debater");
  const n = participants.length;

  // 1. The rounds: every participant argues its fixed stance against the prior rounds' transcript; a round runs in parallel.
  const transcript: Turn[] = [];
  for (let round = 1; round <= rounds; round++) {
    const prior = transcript.length ? transcriptOf(transcript) : `(none; this is round 1 of ${rounds})`;
    const raw = await ctx.rt.parallel(
      participants.map((participant, i) => async () => {
        const others = participants.filter((_, j) => j !== i);
        const out = await callRole(
          ctx,
          spec,
          "debater",
          buildPrompt({
            role: "debater",
            task: spec.task,
            context: spec.context,
            entry: debaterEntry,
            returns: { shape: `your position in round ${round} of ${rounds}: the claim, the strongest evidence for it, any point you concede`, maxLines: POSITION_LINES },
            artifactDir: ctx.artifactDir,
            sections: [
              { title: "STANCE", body: line(participant) },
              { title: "OTHER PARTICIPANTS", body: others.length ? others.map(line).join("\n") : "(none)" },
              { title: "PRIOR ROUNDS", body: prior },
            ],
          }),
          `debater ${i + 1}/${n} r${round}`,
        );
        return { participant, out };
      }),
    );
    const turns: Turn[] = [];
    const blocked: string[] = [];
    for (let i = 0; i < n; i++) {
      const participant = participants[i]!;
      const out = raw[i]?.out ?? null;
      if (!out) return { ...fail(spec, `debater ${participant.name} returned nothing in round ${round}`, round), artifacts: [] };
      const q = blockedQuestion(out);
      if (q) blocked.push(`${participant.name} (round ${round}): ${q}`);
      else turns.push({ round, participant, position: cutLines(str(out, "position"), POSITION_LINES) });
    }
    if (blocked.length) return { id: spec.id, status: "blocked", result: cutLines(transcriptOf(transcript), returns.maxLines), artifacts: [], question: blocked.join("\n"), iterations: round };
    transcript.push(...turns);
  }

  // 2. The judge reads the whole transcript and returns the verdict in the dispatch's contract.
  const judge = await callRole(
    ctx,
    spec,
    "judge",
    buildPrompt({
      role: "judge",
      task: spec.task,
      context: spec.context,
      entry: judgeEntry,
      returns,
      artifactDir: ctx.artifactDir,
      sections: [
        { title: "PARTICIPANTS", body: participants.map(line).join("\n") },
        { title: `TRANSCRIPT (${rounds} round${rounds === 1 ? "" : "s"})`, body: transcriptOf(transcript) },
      ],
    }),
    "judge",
  );
  if (!judge) return fail(spec, `judge returned nothing after ${rounds} round(s)`, rounds);
  const artifacts = strArr(judge, "artifacts");
  const verdict = cutLines(str(judge, "verdict"), returns.maxLines);
  const jq = blockedQuestion(judge);
  if (jq) return { id: spec.id, status: "blocked", result: verdict, artifacts, question: jq, iterations: rounds };
  // The reasoning line always survives the cut, as the evaluator's feedback does: the verdict gives up its last line for it.
  const reasoning = firstLine(str(judge, "reasoning"));
  if (!reasoning) return { id: spec.id, status: "done", result: verdict, artifacts, iterations: rounds };
  const tail = `-- judge reasoning: ${reasoning}`;
  const head = returns.maxLines > 1 ? cutLines(verdict, returns.maxLines - 1) : "";
  return { id: spec.id, status: "done", result: head ? `${head}\n${tail}` : tail, artifacts, iterations: rounds };
}

export const debate: TopologyImpl = {
  demand: (_spec, params) => {
    const p = params["participants"];
    const n = Array.isArray(p) ? p.length : 0;
    if (n > MAX_PARTICIPANTS) return 0;
    return n * int(params["rounds"], DEFAULT_ROUNDS) + 1;
  },
  run: runDebate,
};
