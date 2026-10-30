// ---------- generator-evaluator ----------
import type { DispatchResult, DispatchSpec, GeneratorEvaluatorParams } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { DEFAULT_ITERATIONS, type TopologyContext, blockedQuestion, callRole, contractOf, cutLines, fail, firstLine, int, roleEntry, str, strArr } from "./shared.ts";

export async function runGeneratorEvaluator(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const params = spec.params as Partial<GeneratorEvaluatorParams>;
  const maxIterations = int(params.max_iterations, DEFAULT_ITERATIONS);
  const criteria = typeof params.pass_criteria === "string" && params.pass_criteria ? params.pass_criteria : "the task is complete and correct";
  const genEntry = roleEntry(spec, "generator");
  const evalEntry = roleEntry(spec, "evaluator");

  let feedback: string | null = null;
  let last: { result: string; artifacts: string[] } | null = null;

  for (let round = 1; round <= maxIterations; round++) {
    const sections: Array<{ title: string; body: string }> = [];
    if (feedback !== null && last) {
      sections.push({ title: `FEEDBACK (evaluator, round ${round - 1})`, body: feedback || "(no feedback given)" });
      sections.push({ title: "YOUR ARTIFACTS FROM THE PREVIOUS ROUND (re-open from disk as needed)", body: last.artifacts.length ? last.artifacts.join("\n") : "none" });
    }
    sections.push({ title: "PASS CRITERIA (what the evaluator will check)", body: criteria });
    const gen = await callRole(
      ctx,
      spec,
      "generator",
      buildPrompt({ role: "generator", task: spec.task, context: spec.context, entry: genEntry, returns, artifactDir: ctx.artifactDir, sections }),
      `generator r${round}`,
    );
    if (!gen) return { ...fail(spec, `generator returned nothing in round ${round}`, round), artifacts: last?.artifacts ?? [] };
    const gq = blockedQuestion(gen);
    last = { result: cutLines(str(gen, "result"), returns.maxLines), artifacts: strArr(gen, "artifacts") };
    if (gq) return { id: spec.id, status: "blocked", result: last.result, artifacts: last.artifacts, question: gq, iterations: round };

    const ev = await callRole(
      ctx,
      spec,
      "evaluator",
      buildPrompt({
        role: "evaluator",
        task: spec.task,
        context: spec.context,
        entry: evalEntry,
        returns: { shape: "pass or fail with numbered feedback", maxLines: 10 },
        artifactDir: ctx.artifactDir,
        sections: [
          { title: "PASS CRITERIA", body: criteria },
          { title: `SUBMISSION (round ${round})`, body: `${last.result}\nartifacts: ${last.artifacts.length ? last.artifacts.join(", ") : "none"}` },
        ],
      }),
      `evaluator r${round}`,
    );
    if (!ev) return { ...fail(spec, `evaluator returned nothing in round ${round}`, round), artifacts: last.artifacts };
    const eq = blockedQuestion(ev);
    if (eq) return { id: spec.id, status: "blocked", result: last.result, artifacts: last.artifacts, question: eq, iterations: round };
    if (ev["pass"] === true) return { id: spec.id, status: "done", result: last.result, artifacts: last.artifacts, iterations: round };
    feedback = str(ev, "feedback");
  }

  // The feedback line always survives the cut: the result gives up its last line for it.
  const tail = `-- exhausted after ${maxIterations} round(s); last evaluator feedback: ${firstLine(feedback ?? "")}`;
  const head = returns.maxLines > 1 ? cutLines(last?.result ?? "", returns.maxLines - 1) : "";
  return {
    id: spec.id,
    status: "exhausted",
    result: head ? `${head}\n${tail}` : tail,
    artifacts: last?.artifacts ?? [],
    iterations: maxIterations,
  };
}
