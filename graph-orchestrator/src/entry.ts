/**
 * The Workflow script entry. esbuild bundles this file into workflows/wave.js;
 * build.mjs then replaces the module export with the script body the harness
 * expects: `export const meta = {...}` first, and a top-level
 * `return await runWave(args, { agent, parallel, log })` last.
 */
import { runWave } from "./wave.ts";
export { runWave };
