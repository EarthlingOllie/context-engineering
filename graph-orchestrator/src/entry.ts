/**
 * The Workflow script entry. esbuild bundles this file into workflows/dispatch.js;
 * build.mjs then replaces the module export with the script body the harness
 * expects: `export const meta = {...}` first, and a top-level
 * `return await runWorkflow(args, { agent, parallel, log })` last.
 */
import { runWorkflow } from "./run.ts";
export { runWorkflow };
