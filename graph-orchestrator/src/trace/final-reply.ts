/**
 * The final reply's template (finding C). SKILL.md's Finish section holds the
 * same text for SCRATCH/session.mmd, and a test keeps the two equal. The
 * renderer prints it once the diagram is saved, so the shape is in view when
 * the orchestrator writes the reply.
 */
export function finalReplySkeleton(diagram: string): string {
  return [
    "UNVERIFIED",
    "- <item>: <artifact paths>; <why no evaluator passed it>   (or: - none)",
    "STATUS: <where the task stands, one line>",
    "<summary: at most 3 plain lines>",
    "ARTIFACTS",
    "- <path>",
    "DECISIONS",
    "- <decision that needs the human's eyes>",
    `DIAGRAM: send ${diagram} as a file, never its text`,
    "",
  ].join("\n");
}
