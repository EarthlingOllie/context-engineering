/**
 * Roles: six prompt fragments, each a stance plus a structured-output schema.
 * `agent()` cannot name an agent definition or restrict tools (spike item 7),
 * so tool discipline is stated in the stance, not enforced. The domain never
 * comes from the role; it comes from the skill named at dispatch time.
 */
import type { RoleEntry, ReturnContract } from "./types.ts";

export type RoleName = "worker" | "generator" | "evaluator" | "judge" | "reducer" | "debater";

const blockedProps = {
  blocked: {
    type: "boolean",
    description:
      "true only if finishing needs an answer that only a human can give. Then put the one question in `question` and stop.",
  },
  question: { type: "string", description: "The single question for the human. Empty unless blocked." },
};

const workOutput = {
  type: "object",
  properties: {
    result: { type: "string", description: "The inline result, in the RETURN shape, within its line limit." },
    artifacts: {
      type: "array",
      items: { type: "string" },
      description: "Absolute paths of files you wrote or that carry the full result. Empty if none.",
    },
    ...blockedProps,
  },
  required: ["result", "artifacts", "blocked"],
};

export const ROLE_SCHEMAS: Record<RoleName, Record<string, unknown>> = {
  worker: workOutput,
  generator: workOutput,
  reducer: workOutput,
  evaluator: {
    type: "object",
    properties: {
      pass: { type: "boolean", description: "true only if every pass criterion is met." },
      feedback: {
        type: "string",
        description:
          "At most 10 lines. Numbered, specific, actionable; each point names where (file:line or section). Empty when pass is true.",
      },
      ...blockedProps,
    },
    required: ["pass", "feedback", "blocked"],
  },
  judge: {
    type: "object",
    properties: {
      verdict: { type: "string", description: "The verdict, in the RETURN shape, within its line limit." },
      reasoning: { type: "string", description: "At most 5 lines: the decisive consideration and what would overturn it." },
      artifacts: { type: "array", items: { type: "string" } },
      ...blockedProps,
    },
    required: ["verdict", "reasoning", "artifacts", "blocked"],
  },
  debater: {
    type: "object",
    properties: {
      position: {
        type: "string",
        description: "At most 8 lines: your position this round, the strongest evidence for it, and any point you concede.",
      },
      ...blockedProps,
    },
    required: ["position", "blocked"],
  },
};

export const ROLE_STANCES: Record<RoleName, string> = {
  worker: [
    "You are a worker inside an orchestrated wave. Do the TASK completely, then report once.",
    "You may read, search, write and run whatever the task requires. Load your own project conventions from disk; nothing about them is repeated here.",
    "Do not narrate progress, do not restate this prompt, do not ask how things are going. Your final structured output is the only thing anyone sees.",
  ].join("\n"),
  generator: [
    "You are the generator in a generate-and-evaluate loop. Produce the deliverable the TASK describes, as files on disk where it is code or long text, and report it in the RETURN shape.",
    "When FEEDBACK is present it is the evaluator's verdict on your previous round. Address every numbered point. Your own previous output is deliberately not shown; re-open your ARTIFACTS from disk if you need them.",
    "You may read, search, write and run as the task requires. Do not narrate.",
  ].join("\n"),
  evaluator: [
    "You are the evaluator in a generate-and-evaluate loop. Judge the SUBMISSION strictly against the PASS CRITERIA and nothing else.",
    "Read and run whatever you need to verify it (open the artifacts, run the tests). Change nothing on disk.",
    "pass=true only when every criterion is met. Otherwise feedback is a numbered list of specific, actionable points with locations, and nothing else.",
  ].join("\n"),
  judge: [
    "You are the judge. You receive the task and the full debate transcript; you return one verdict in the RETURN shape.",
    "Decide on the arguments and evidence presented. Do not introduce a new position. Name the decisive consideration.",
    "You may read files the debaters cite to check a claim. Change nothing on disk.",
  ].join("\n"),
  reducer: [
    "You are the reducer of a fan-out. Merge the BRANCH RESULTS into one answer in the RETURN shape.",
    "A blocked branch is a gap: note it in one line, do not redo its work. Prefer the branches' artifacts over re-deriving anything.",
    "Read artifacts as needed; write a merged artifact if the result exceeds the line limit. Do not narrate.",
  ].join("\n"),
  debater: [
    "You are a debater holding the STANCE below. Argue it with evidence from the task and the codebase, engage the other positions from the PRIOR ROUND directly, and concede any specific point the evidence is against.",
    "You may read and search. Change nothing on disk. Keep to the position length limit.",
  ].join("\n"),
};

export type PromptParts = {
  role: RoleName;
  task: string;
  context: string[];
  entry?: RoleEntry | undefined;
  returns: ReturnContract;
  artifactDir: string;
  sections?: Array<{ title: string; body: string }>; // topology-specific, e.g. FEEDBACK, PASS CRITERIA
};

/** Assemble a role prompt: stance + task + context + instructions + skill + extras + return contract. */
export function buildPrompt(p: PromptParts): string {
  const lines: string[] = [];
  lines.push(`ROLE: ${p.role}`);
  lines.push(ROLE_STANCES[p.role]);
  lines.push("");
  lines.push(`TASK: ${p.task}`);
  lines.push("");
  lines.push("CONTEXT (facts established this session that you cannot derive from disk):");
  if (p.context.length === 0) lines.push("- none");
  for (const c of p.context) lines.push(`- ${c}`);
  if (p.entry?.skill) {
    lines.push("");
    lines.push(
      `SKILL: load and follow the skill \`${p.entry.skill}\` before you start (via the Skill tool, or by reading its SKILL.md if it is not listed). It supplies the domain conventions for this role.`,
    );
  }
  if (p.entry?.instructions) {
    lines.push("");
    lines.push("INSTRUCTIONS:");
    lines.push(p.entry.instructions);
  }
  for (const s of p.sections ?? []) {
    lines.push("");
    lines.push(`${s.title}:`);
    lines.push(s.body);
  }
  lines.push("");
  lines.push(
    `ARTIFACTS: anything longer than the return contract goes in a file under ${p.artifactDir}/ ; return its absolute path in \`artifacts\`. Never put a file's contents in the inline result.`,
  );
  lines.push("");
  lines.push(
    `RETURN: at most ${p.returns.maxLines} lines — ${p.returns.shape}. Nothing else: no file dumps, no process narration, no restating this prompt.`,
  );
  lines.push(
    "BLOCKED: if you cannot finish without an answer only a human can give, or the task requires something hard to reverse that it did not explicitly authorise, stop and set blocked=true with the one question. Do not guess.",
  );
  return lines.join("\n");
}
