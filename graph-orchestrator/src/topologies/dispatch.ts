/**
 * The dispatch seam: the agent demand of a spec and the run of one spec, each
 * looked up by `spec.topology` in the registry below. TOPOLOGIES in types.ts
 * is the source of truth for the union; the registry is keyed by it, so a
 * topology without an entry is a type error. Nothing in here throws for a bad
 * spec; it returns `failed` so a wave always comes back whole.
 */
import type { DispatchResult, DispatchSpec, Topology } from "../types.ts";
import { TOPOLOGIES } from "../types.ts";
import { type TopologyContext, type TopologyImpl, contractOf, fail } from "./shared.ts";
import { single } from "./single.ts";
import { generatorEvaluator } from "./generator-evaluator.ts";
import { fanOut } from "./fan-out.ts";
import { debate } from "./debate.ts";
import { chain } from "./chain.ts";

const REGISTRY: Record<Topology, TopologyImpl> = {
  single,
  "generator-evaluator": generatorEvaluator,
  "fan-out": fanOut,
  debate,
  chain,
};

function isTopology(t: unknown): t is Topology {
  return (TOPOLOGIES as readonly unknown[]).includes(t);
}

// ---------- agent demand ----------

/**
 * Upper bound on the agents a dispatch may spawn. Logged against the cap, and
 * summed for the run limit. A spec a cap refuses (`over_budget`) spends nothing,
 * so it counts 0.
 */
export function agentDemand(raw: Partial<DispatchSpec> | null | undefined): number {
  const spec: Partial<DispatchSpec> = raw && typeof raw === "object" ? raw : {};
  const params = (spec.params && typeof spec.params === "object" ? spec.params : {}) as Record<string, unknown>;
  return isTopology(spec.topology) ? REGISTRY[spec.topology].demand(spec, params) : 0;
}

/** Run one dispatch spec. Never throws: a spec that cannot run returns `failed`. */
export async function runDispatch(ctx: TopologyContext, raw: DispatchSpec): Promise<DispatchResult> {
  if (!raw || typeof raw !== "object") return fail({ id: "?" }, "dispatch spec is not an object");
  if (typeof raw.id !== "string" || !raw.id) return fail({ id: "?" }, "dispatch spec has no id");
  if (!isTopology(raw.topology)) return fail(raw, `unknown topology "${String(raw.topology)}"; valid: ${TOPOLOGIES.join(", ")}`);
  const spec: DispatchSpec = {
    ...raw,
    task: typeof raw.task === "string" ? raw.task : "",
    context: Array.isArray(raw.context) ? raw.context.map(String) : [],
    roles: raw.roles && typeof raw.roles === "object" ? raw.roles : {},
    params: raw.params && typeof raw.params === "object" ? raw.params : {},
    returns: contractOf(raw),
    dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String) : [],
  };
  if (!spec.task) return fail(spec, "dispatch spec has no task");
  try {
    return await REGISTRY[spec.topology].run(ctx, spec);
  } catch (err) {
    return fail(spec, `topology threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}
