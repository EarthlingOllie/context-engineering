/**
 * The one place a Workflow agent label is formatted. Each dispatch runs as its
 * own workflow, named "<Topology>: <title>" by the orchestrator ("Fan-out: Map
 * trace file access"), so inside it an agent is labelled
 *
 *   <role> (n of m): <task>
 *
 * "Generator (1 of 3): Add the retry policy", "Worker (2 of 4): parse headers",
 * "Judge: Pick a parser". `(n of m)` places the agent among the instances of its
 * role and is left out when only one is configured. A role with a second axis
 * (a debater's rounds, an iterative fan-out's rounds) names that axis:
 * "Debater pro (round 1 of 2)", "Worker (round 2 of 3, 1 of 2)". A chain's
 * stages each run their own topology, so a stage agent also names its stage
 * and that topology: "Stage 2 · Generator-evaluator, Generator (1 of 2): …".
 * The task is the agent's own (a branch's sub-task, else the dispatch's or
 * stage's), one line, at most 40 characters.
 */

export type LabelRole = "worker" | "generator" | "evaluator" | "partition" | "reducer" | "judge" | "debater" | "scribe";

export type AgentLabelParts = {
  /** The dispatch's (or chain stage's) topology; shown only for a chain stage, whose workflow name says only "Chain". */
  topology?: string;
  role: LabelRole;
  /** The dispatch or chain-stage id; only a chain stage suffix (`-s2`) shows. */
  id?: string;
  /** Who the agent is within its role: a debater's name, a panel lens. */
  name?: string;
  /** What this agent is doing: a branch's sub-task, or the dispatch's task. */
  task?: string;
  /** This agent among the instances of its role: branch, attempt, session, lens, check. */
  index?: number;
  count?: number;
  /** The round, when the role repeats across rounds. */
  round?: number;
  rounds?: number;
};

export const EXCERPT_MAX = 40;

const ROLE_TITLES: Record<LabelRole, string> = {
  worker: "Worker",
  generator: "Generator",
  evaluator: "Evaluator",
  partition: "Partition",
  reducer: "Reducer",
  judge: "Judge",
  debater: "Debater",
  scribe: "Trace scribe",
};

const TOPOLOGY_TITLES: Record<string, string> = {
  single: "Single",
  "generator-evaluator": "Generator-evaluator",
  "fan-out": "Fan-out",
  chain: "Chain",
  relay: "Relay",
  "best-of-n": "Best-of-n",
  "iterative-fan-out": "Iterative fan-out",
  panel: "Panel",
  debate: "Debate",
};

/** "Fan-out" for `fan-out`, as it heads a workflow name and a stage label; an unknown topology is shown as given, first letter capitalised. */
export function topologyTitle(topology: string): string {
  const t = String(topology).trim();
  return TOPOLOGY_TITLES[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

/** One line of the text, whitespace collapsed, at most EXCERPT_MAX characters including the ellipsis. */
export function taskExcerpt(task: string | undefined, max = EXCERPT_MAX): string {
  const line = String(task ?? "").replace(/\s+/g, " ").trim();
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}

/** "2" for `w1-d3-s2`, "2.1" for `w1-d3-s2-s1`; "" for an id that is not a chain stage. */
export function stageOf(id: string | undefined): string {
  const m = /((?:-s\d+)+)$/.exec(String(id ?? ""));
  return m ? m[1]!.split("-s").filter(Boolean).join(".") : "";
}

const ofN = (i: number, n: number | undefined) => `${i}${n !== undefined ? ` of ${n}` : ""}`;

/** "1 of 3", "round 2 of 3, 1 of 2", "round 1 of 2"; "" when the role has one instance. An axis whose total is 1 is left out. */
function position(parts: AgentLabelParts): string {
  const out: string[] = [];
  const hasIndex = parts.index !== undefined && parts.count !== 1;
  if (parts.round !== undefined && parts.rounds !== 1) {
    // Bare when rounds are the role's only axis; named when the role also has an index (even a lone one) or a name.
    const secondAxis = parts.index !== undefined || parts.name !== undefined;
    out.push(`${secondAxis ? "round " : ""}${ofN(parts.round, parts.rounds)}`);
  }
  if (hasIndex) out.push(ofN(parts.index!, parts.count));
  return out.join(", ");
}

export function agentLabel(parts: AgentLabelParts): string {
  const stage = stageOf(parts.id);
  const topology = stage ? [`Stage ${stage}`, parts.topology ? topologyTitle(parts.topology) : ""].filter(Boolean).join(" · ") : "";
  const role = ROLE_TITLES[parts.role] + (parts.name ? ` ${parts.name}` : "");
  const pos = position(parts);
  const excerpt = taskExcerpt(parts.task);
  return `${topology ? `${topology}, ` : ""}${role}${pos ? ` (${pos})` : ""}${excerpt ? `: ${excerpt}` : ""}`;
}
