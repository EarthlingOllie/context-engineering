// ---------- chain ----------
import type { ChainParams, DispatchResult, DispatchSpec } from "../types.ts";
import { type TopologyContext, type TopologyImpl, contractOf, cutLines, dispatchEvent, fail, forwardLines, normaliseSpec, uniq } from "./shared.ts";
import { agentDemand, runDispatch } from "./dispatch.ts";

/** A stage is a dispatch spec numbered after its parent, seeing the parent's context, then its own, then what the previous stage forwarded. */
function normaliseStage(parent: DispatchSpec, stage: unknown, index: number, forwarded: string[]): DispatchSpec {
  const s = normaliseSpec(stage, { id: `${parent.id}-s${index + 1}`, context: parent.context, returns: parent.returns });
  s.context.push(...forwarded);
  return s;
}

async function runChain(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const stages = (spec.params as Partial<ChainParams>).stages;
  if (!Array.isArray(stages) || stages.length === 0) return fail(spec, "chain: `params.stages` must be a non-empty list of dispatch specs");

  const statuses: string[] = [];
  const artifacts: string[] = [];
  let prev: DispatchResult | null = null;
  for (let i = 0; i < stages.length; i++) {
    const forwarded = prev ? forwardLines(prev) : [];
    const stage = normaliseStage(spec, stages[i], i, forwarded);
    const r = await runDispatch(ctx, stage);
    ctx.stageEvents.push(dispatchEvent(ctx.wave, stage, r, spec.id));
    statuses.push(`${stage.id}:${r.status}`);
    artifacts.push(...r.artifacts);
    if (r.status !== "done") {
      const out: DispatchResult = {
        id: spec.id,
        status: r.status,
        result: cutLines(`stage ${stage.id} ${r.status}: ${r.result}`, returns.maxLines),
        artifacts: uniq(artifacts),
        iterations: i + 1,
        stages: statuses,
      };
      if (r.question) out.question = r.question;
      return out;
    }
    prev = r;
  }
  return { id: spec.id, status: "done", result: cutLines(prev?.result ?? "", returns.maxLines), artifacts: uniq(artifacts), iterations: stages.length, stages: statuses };
}

export const chain: TopologyImpl = {
  demand: (_spec, params) => {
    const stages = params["stages"];
    return Array.isArray(stages) ? stages.reduce((s: number, st) => s + agentDemand(st as DispatchSpec), 0) : 0;
  },
  run: runChain,
};
