// ---------- chain ----------
import type { ChainParams, ChainStage, DispatchResult, DispatchSpec } from "../types.ts";
import { type TopologyContext, type TopologyImpl, contractOf, cutLines, dispatchEvent, fail, firstLine, forwardLines, normaliseSpec, recordStageLines, traceDetail, uniq } from "./shared.ts";
import { agentDemand, runDispatch } from "./dispatch.ts";

/** A stage is a dispatch spec numbered after its parent, seeing the parent's context, then its own, then what the previous stage forwarded. */
function normaliseStage(parent: DispatchSpec, stage: unknown, index: number, forwarded: string[]): DispatchSpec {
  const s = normaliseSpec(stage, { id: `${parent.id}-s${index + 1}`, context: parent.context, returns: parent.returns });
  s.context.push(...forwarded);
  return s;
}

/** How a stage is named in the `not run:` list: its id, then its title in quotes when it has one. */
function stageName(s: DispatchSpec): string {
  return s.title ? `${s.id} "${s.title}"` : s.id;
}

/** A non-last panel stage whose verdict line is FAIL stops the chain, unless the stage sets `gate: false`. */
function panelGateTrips(stage: DispatchSpec, r: DispatchResult, last: boolean): boolean {
  return !last && stage.topology === "panel" && (stage as ChainStage).gate !== false && r.status === "done" && /^FAIL\b/.test(r.result);
}

/**
 * The chain's result: one `<stage id> <status>: <first line>` line per stage
 * run, then the last run stage's lines, cut to the line limit; a chain that
 * stopped early keeps a final `not run: <stages>` line inside that limit.
 */
function chainResult(ctx: TopologyContext, lines: string[], last: string, notRun: DispatchSpec[], maxLines: number): string {
  const body = [...lines, ...(last ? last.split("\n") : [])].join("\n");
  if (!notRun.length) return cutLines(body, maxLines, ctx);
  const tail = `not run: ${notRun.map(stageName).join(", ")}`;
  return maxLines <= 1 ? tail : `${cutLines(body, maxLines - 1, ctx)}\n${tail}`;
}

async function runChain(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const stages = (spec.params as Partial<ChainParams>).stages;
  if (!Array.isArray(stages) || stages.length === 0) return fail(spec, "chain: `params.stages` must be a non-empty list of dispatch specs");

  const statuses: string[] = [];
  const stageLines: string[] = [];
  const artifacts: string[] = [];
  let prev: DispatchResult | null = null;
  for (let i = 0; i < stages.length; i++) {
    const forwarded = prev ? forwardLines(prev) : [];
    const stage = normaliseStage(spec, stages[i], i, forwarded);
    const droppedBefore = ctx.dropped ?? 0;
    let r = await runDispatch(ctx, stage);
    if (panelGateTrips(stage, r, i === stages.length - 1)) {
      const [verdict, ...rest] = r.result.split("\n");
      r = { ...r, status: "exhausted", result: [`panel ${stageName(stage)} returned ${verdict}`, ...rest].join("\n") };
    }
    ctx.stageEvents.push({ ...dispatchEvent(ctx.wave, stage, r, spec.id), ...traceDetail(ctx, stage.id, (ctx.dropped ?? 0) - droppedBefore) });
    statuses.push(`${stage.id}:${r.status}`);
    stageLines.push(`${stage.id} ${r.status}: ${firstLine(r.result)}`);
    recordStageLines(ctx, spec, stageLines);
    artifacts.push(...r.artifacts);
    if (r.status !== "done") {
      const notRun = stages.slice(i + 1).map((st, j) => normaliseStage(spec, st, i + 1 + j, []));
      const out: DispatchResult = {
        id: spec.id,
        status: r.status,
        result: chainResult(ctx, stageLines, r.result, notRun, returns.maxLines),
        artifacts: uniq(artifacts),
        iterations: i + 1,
        stages: statuses,
      };
      if (r.question) out.question = r.question;
      return out;
    }
    prev = r;
  }
  return { id: spec.id, status: "done", result: chainResult(ctx, stageLines, prev?.result ?? "", [], returns.maxLines), artifacts: uniq(artifacts), iterations: stages.length, stages: statuses };
}

export const chain: TopologyImpl = {
  demand: (_spec, params) => {
    const stages = params["stages"];
    return Array.isArray(stages) ? stages.reduce((s: number, st) => s + agentDemand(st as DispatchSpec), 0) : 0;
  },
  run: runChain,
};
