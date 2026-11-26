// Deterministic clock and randomness for the Workflow sandbox (Date.now/new Date()/Math.random throw there, for resume).
// Seeded from args.now via __setClock; ticks 1 ms per read so ids stay unique and replay identically.
const RealDate = globalThis.Date;
let base = 0, tick = 0, seed = 1;
export function __setClock(iso) { base = iso ? RealDate.parse(iso) || 0 : 0; tick = 0; seed = 1; }
function nowMs() { return base + tick++; }
function ShimDate(...a) { if (!new.target) return new RealDate(nowMs()).toString(); return a.length ? new RealDate(...a) : new RealDate(nowMs()); }
ShimDate.now = nowMs; ShimDate.parse = RealDate.parse; ShimDate.UTC = RealDate.UTC; ShimDate.prototype = RealDate.prototype;
export { ShimDate as Date };
const shimMath = Object.create(globalThis.Math);
shimMath.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export { shimMath as Math };
