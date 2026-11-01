/**
 * The one place a Workflow agent label is formatted. A label reads as
 * "Wave 1 · d1 Generator, round 1 of 3 — <task excerpt>": the dispatch id
 * `w1-d1` is shown as "Wave 1 · d1" and stays recoverable with
 * `dispatchIdOfLabel`. An id outside the `w<N>-` scheme is shown verbatim.
 * The scribe belongs to the wave, not a dispatch: "Wave 1 · Trace scribe".
 */

export type LabelRole = "worker" | "generator" | "evaluator" | "partition" | "reducer";

export type AgentLabelParts =
  | { id: string; role: LabelRole; task?: string; round?: number; rounds?: number; branch?: number; branches?: number }
  | { wave: number; role: "scribe" };

export const EXCERPT_MAX = 40;
const SCRIBE = "Trace scribe";

const TITLES: Record<LabelRole, string> = {
  worker: "Worker",
  generator: "Generator",
  evaluator: "Evaluator",
  partition: "Partition",
  reducer: "Reducer",
};

/** One line of the task, whitespace collapsed, at most EXCERPT_MAX characters including the ellipsis. */
export function taskExcerpt(task: string | undefined): string {
  const line = String(task ?? "").replace(/\s+/g, " ").trim();
  return line.length <= EXCERPT_MAX ? line : `${line.slice(0, EXCERPT_MAX - 1).trimEnd()}…`;
}

function displayId(id: string): string {
  const m = /^w(\d+)-(\S+)$/.exec(id);
  return m ? `Wave ${m[1]} · ${m[2]}` : id;
}

export function agentLabel(parts: AgentLabelParts): string {
  if (parts.role === "scribe") return `Wave ${parts.wave} · ${SCRIBE}`;
  let role = TITLES[parts.role];
  if (parts.round !== undefined) role += `, round ${parts.round}${parts.rounds !== undefined ? ` of ${parts.rounds}` : ""}`;
  if (parts.branch !== undefined) role += `, branch ${parts.branch}${parts.branches !== undefined ? ` of ${parts.branches}` : ""}`;
  const excerpt = taskExcerpt(parts.task);
  return `${displayId(parts.id)} ${role}${excerpt ? ` — ${excerpt}` : ""}`;
}

/** The dispatch id a label was built from, or null for the scribe. */
export function dispatchIdOfLabel(label: string): string | null {
  const m = /^Wave (\d+) · (\S+)/.exec(label);
  if (m) return label.startsWith(`Wave ${m[1]} · ${SCRIBE}`) ? null : `w${m[1]}-${m[2]}`;
  return label.split(" ")[0] || null;
}
