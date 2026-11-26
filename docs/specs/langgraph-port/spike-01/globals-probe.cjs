// Which non-ECMAScript globals does the bundle need? Runs it once per candidate with that one global removed.
// Usage: node globals-probe.cjs            (parent)   — prints the globals whose removal breaks the run
const fs = require("fs"), vm = require("vm"), { execFileSync } = require("child_process");
const POOL = ["setTimeout","clearTimeout","setInterval","clearInterval","queueMicrotask","structuredClone","TextEncoder","TextDecoder","URL","AbortController","AbortSignal","EventTarget","Event","ReadableStream","WritableStream","TransformStream","crypto","atob","btoa","performance"];
if (process.argv[2] === "--child") {
  const drop = process.argv[3];
  const src = fs.readFileSync("spike-graph.js", "utf8").replace(/^export const meta = /m, "const meta = ");
  const ctx = { agent: async (p, o = {}) => (o.schema ? { pass: true } : "x"), log: () => {}, args: { task: "t", now: "2026-11-26T00:00:00Z" }, console };
  for (const k of POOL) if (k !== drop) ctx[k] = globalThis[k];
  vm.createContext(ctx);
  const t = setTimeout(() => { console.log("hang"); process.exit(3); }, 5000);
  process.on("unhandledRejection", (e) => { console.log(String(e).slice(0, 80)); process.exit(2); });
  process.on("uncaughtException", (e) => { console.log(String(e).slice(0, 80)); process.exit(2); });
  vm.runInContext(`(async()=>{${src}\n})()`, ctx).then(() => { clearTimeout(t); process.exit(0); }, (e) => { console.log(String(e).slice(0, 80)); process.exit(2); });
} else {
  const needed = [];
  for (const k of POOL) {
    try { execFileSync(process.execPath, [__filename, "--child", k], { stdio: "pipe" }); }
    catch (e) { needed.push(`${k} (${String(e.stdout).trim()})`); }
  }
  console.log("NEEDED:\n" + (needed.join("\n") || "(none)"));
}
