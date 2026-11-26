// Local stand-in for the Workflow sandbox: no imports, no Node APIs, and Date.now / new Date() / Math.random throw.
// The web globals passed in are a GUESS at what the real sandbox has; spike item 4 checks them live.
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(process.argv[2] || "spike-graph.js", "utf8").replace(/^export const meta = /m, "const meta = ");
const calls = [];
const agent = async (p, o = {}) => { calls.push(o.label); await new Promise((r) => setTimeout(r, 5)); return o.schema ? { pass: /r2/.test(p) } : `out:${p.slice(0, 20)}`; };
const g = globalThis;
const ctx = { agent, log: (m) => console.log("LOG", m), args: { task: "t", now: "2026-11-26T00:00:00Z" }, console,
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, structuredClone, TextEncoder, TextDecoder, URL, AbortController, AbortSignal,
  EventTarget, Event, ReadableStream: g.ReadableStream, WritableStream: g.WritableStream, TransformStream: g.TransformStream, crypto: g.crypto, atob, btoa };
vm.createContext(ctx);
vm.runInContext(`(()=>{const RD=Date;function D(...a){if(!new.target||!a.length)throw new Error('Date unavailable');return new RD(...a)}D.now=()=>{throw new Error('Date.now unavailable')};D.parse=RD.parse;D.UTC=RD.UTC;D.prototype=RD.prototype;globalThis.Date=D;Math.random=()=>{throw new Error('Math.random unavailable')}})()`, ctx);
vm.runInContext(`(async()=>{${src}\n})()`, ctx)
  .then((r) => console.log("RESULT", JSON.stringify(r), "\nAGENTS", calls.join(" | ")))
  .catch((e) => { console.log("THREW", e.stack.split("\n").slice(0, 6).join("\n")); process.exit(1); });
