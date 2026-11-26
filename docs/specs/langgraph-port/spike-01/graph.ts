import { __setClock } from "./clock-shim.js";
import { StateGraph, Annotation, Send, START, END } from "@langchain/langgraph/web";
export async function runGraph(args: any, rt: { agent: any; log: any }) {
  __setClock(args.now);
  const S = Annotation.Root({
    task: Annotation<string>(),
    branches: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
    draft: Annotation<string>(),
    round: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
    pass: Annotation<boolean>(),
  });
  const g = new StateGraph(S)
    .addNode("branch", async (s: any) => ({ branches: [await rt.agent(`branch ${s.part}`, { label: `Branch ${s.part}`, phase: "Fan-out" })] }))
    .addNode("generator", async (s) => ({ draft: await rt.agent(`gen r${s.round + 1} from ${s.branches.length}`, { label: `Generator (round ${s.round + 1})`, phase: "Loop" }), round: s.round + 1 }))
    .addNode("evaluator", async (s) => ({ pass: (await rt.agent(`eval ${s.draft}`, { label: `Evaluator (round ${s.round})`, phase: "Loop", schema: { type: "object", properties: { pass: { type: "boolean" } }, required: ["pass"] } })).pass }))
    .addConditionalEdges(START, (s) => [1, 2, 3].map((i) => new Send("branch", { ...s, part: i })))
    .addEdge("branch", "generator")
    .addEdge("generator", "evaluator")
    .addConditionalEdges("evaluator", (s) => (s.pass || s.round >= 3 ? END : "generator"));
  const out = await g.compile().invoke({ task: args.task }, { recursionLimit: 25 });
  rt.log(`done after ${out.round} round(s)`);
  return { round: out.round, pass: out.pass, branches: out.branches.length };
}
