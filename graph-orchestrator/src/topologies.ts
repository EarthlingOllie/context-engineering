/**
 * The topologies: single, generator-evaluator, fan-out, chain, relay,
 * best-of-n, iterative-fan-out, panel and debate, one file each under topologies/, with what they share in
 * topologies/shared.ts and the choice by `spec.topology` in
 * topologies/dispatch.ts. Each is a plain async function over an injected
 * runtime, so the whole module runs under test with a fake `agent()`. This
 * file is the barrel: run.ts and the tests import from here only.
 *
 * Caps: width ≤ 9, participants ≤ 6, maxLines ≤ 20, sessions ≤ 10, gap rounds
 * ≤ 3, debate rounds ≤ 4. A spec that exceeds a cap
 * returns `over_budget` without spending an agent. Nothing in here throws for a
 * bad spec; it returns `failed` so a wave always comes back whole.
 */
export {
  DEFAULT_GAP_ROUNDS,
  DEFAULT_ITERATIONS,
  DEFAULT_ROUNDS,
  DEFAULT_SESSIONS,
  DEFAULT_WIDTH,
  MAX_DEBATE_ROUNDS,
  MAX_GAP_ROUNDS,
  MAX_LINES,
  MAX_PARTICIPANTS,
  MAX_SESSIONS,
  MAX_WIDTH,
  type TopologyContext,
  contractOf,
  cutLines,
  dispatchEvent,
  fail,
  firstLine,
  forwardLines,
  normaliseSpec,
} from "./topologies/shared.ts";
export { agentDemand, runDispatch } from "./topologies/dispatch.ts";
