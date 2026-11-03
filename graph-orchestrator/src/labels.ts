/**
 * The one place a Workflow agent label is formatted. Each dispatch runs as its
 * own workflow, named for its purpose, so a label only says which agent this
 * is inside it: "Generator · round 1 of 3", "Branch 2 of 4 — parse headers",
 * "Attempt 2 of 3", "Judge". A chain stage is prefixed with its stage:
 * "Stage 2 · Worker". The scribe is "Trace scribe".
 */

export type LabelRole = "worker" | "generator" | "evaluator" | "partition" | "reducer" | "judge" | "debater" | "scribe";

export type AgentLabelParts = {
  role: LabelRole;
  /** The dispatch or chain-stage id; only a chain stage suffix (`-s2`) shows. */
  id?: string;
  /** Who the agent is within its role: a debater's name, a panel lens. */
  name?: string;
  /** A branch's own sub-task; the dispatch task is the workflow's name, so it is never repeated here. */
  task?: string;
  round?: number;
  rounds?: number;
  session?: number;
  sessions?: number;
  attempt?: number;
  attempts?: number;
  branch?: number;
  branches?: number;
};

export const EXCERPT_MAX = 40;

const TITLES: Record<LabelRole, string> = {
  worker: "Worker",
  generator: "Generator",
  evaluator: "Evaluator",
  partition: "Partition",
  reducer: "Reducer",
  judge: "Judge",
  debater: "Debater",
  scribe: "Trace scribe",
};

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

export function agentLabel(parts: AgentLabelParts): string {
  // A worker that is one of several is named by what it is one of.
  const counters: Array<[string, number | undefined, number | undefined]> = [
    ["Branch", parts.branch, parts.branches],
    ["Attempt", parts.attempt, parts.attempts],
    ["Session", parts.session, parts.sessions],
  ];
  let head = TITLES[parts.role];
  const rest: string[] = [];
  for (const [word, i, n] of counters) {
    if (i === undefined) continue;
    if (parts.role === "worker" && head === TITLES.worker) head = `${word} ${ofN(i, n)}`;
    else rest.push(`${word.toLowerCase()} ${ofN(i, n)}`);
  }
  if (parts.name) head += ` ${parts.name}`;
  if (parts.round !== undefined) rest.push(`round ${ofN(parts.round, parts.rounds)}`);
  const stage = stageOf(parts.id);
  const excerpt = taskExcerpt(parts.task);
  return [stage ? `Stage ${stage}` : "", head, ...rest].filter(Boolean).join(" · ") + (excerpt ? ` — ${excerpt}` : "");
}
