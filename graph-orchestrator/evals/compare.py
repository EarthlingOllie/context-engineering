"""Compare two scorecards: what moved, per sample and per metric, and whether it is noise.

    python graph-orchestrator/evals/compare.py <baseline.json> <fix.json> [--force]

Measured metrics (cost, time, tokens, agents) compare the per-sample mean over
epochs. The noise band is 10% of the baseline value, or the baseline's measured
spread (max - min over its epochs) for that sample when the baseline has more
than one epoch; a difference no larger than the band is marked noise.
Outcome correctness, status truthfulness and false passes compare as counts over
epochs ("2/3" against "3/3"), never as averages, and every change in a count is
reported. Scorecards whose engine version, Inspect version or model differ are
refused unless --force is given.

A sample with no baseline at its revision (new since the baseline, or its
`revision` in the fix's header `sample_revisions` differs from the baseline's;
a card that records none has every sample at revision 1) is not compared: it is
listed under "not gated" with its own counts, so it can never read as a
regression against a baseline that ran a different sample. Freeze a fresh
baseline epoch before gating on it.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

MEASURED = [
    "dollars",
    "wall_clock_s",
    "input_tokens",
    "output_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "cache_write_share",
    "agents",
]
COUNTED = ["outcome_correct", "false_pass", "status_truthful"]
MUST_MATCH = ["engine_version", "inspect_version", "model"]
DEFAULT_BAND = 0.10


class Mismatch(ValueError):
    """The two scorecards were not made under the same engine, Inspect and model."""


def _is_false_pass(row: dict) -> bool:
    if "false_pass" in row and row["false_pass"] is not None:
        return bool(row["false_pass"])
    return row.get("reported_status") == "done" and not row.get("outcome_correct")


def _by_sample(card: dict) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for r in card["rows"]:
        out.setdefault(r["sample"], []).append(r)
    return out


def _values(rows: list[dict], metric: str) -> list[float]:
    return [r[metric] for r in rows if r.get(metric) is not None]


def _mean(xs: list[float]) -> float | None:
    return sum(xs) / len(xs) if xs else None


def _count(rows: list[dict], metric: str) -> int:
    if metric == "false_pass":
        return sum(_is_false_pass(r) for r in rows)
    return sum(bool(r.get(metric)) for r in rows)


def revisions(card: dict) -> dict[str, int]:
    """Each sample's revision as the card records it (header `sample_revisions`); 1 for a sample it does not name."""
    recorded = (card.get("header") or {}).get("sample_revisions") or {}
    return {s: int(recorded.get(s, 1)) for s in _by_sample(card)}


def _report_only(sample: str, reason: str, rows: list[dict]) -> dict:
    return {"sample": sample, "reason": reason, "epochs": len(rows), **{m: _count(rows, m) for m in COUNTED}}


def mismatches(base: dict, fix: dict) -> list[str]:
    hb, hf = base["header"], fix["header"]
    return [f"{k}: {hb.get(k)!r} vs {hf.get(k)!r}" for k in MUST_MATCH if hb.get(k) != hf.get(k)]


def compare(base: dict, fix: dict, *, force: bool = False) -> dict:
    """Return {"mismatches", "lines", "only_in_baseline", "only_in_fix", "no_baseline"}; raise Mismatch unless force."""
    diffs = mismatches(base, fix)
    if diffs and not force:
        raise Mismatch(
            "refusing to compare scorecards made under different conditions:\n  "
            + "\n  ".join(diffs)
            + "\npass --force to compare them anyway"
        )
    bs, fs = _by_sample(base), _by_sample(fix)
    brev, frev = revisions(base), revisions(fix)
    lines: list[dict] = []
    no_baseline: list[dict] = []
    for sample in fs:
        if sample not in bs:
            no_baseline.append(_report_only(sample, "new", fs[sample]))
        elif brev[sample] != frev[sample]:
            no_baseline.append(_report_only(sample, f"revised (baseline r{brev[sample]}, fix r{frev[sample]})", fs[sample]))
    skip = {n["sample"] for n in no_baseline}
    for sample in [s for s in bs if s in fs and s not in skip]:
        brows, frows = bs[sample], fs[sample]
        for metric in COUNTED:
            b, f = _count(brows, metric), _count(frows, metric)
            lines.append({
                "sample": sample, "metric": metric, "kind": "count",
                "baseline": b, "fix": f, "baseline_epochs": len(brows), "fix_epochs": len(frows),
                "diff": f - b, "band": None, "noise": False,
            })
        for metric in MEASURED:
            bv, fv = _values(brows, metric), _values(frows, metric)
            b, f = _mean(bv), _mean(fv)
            if b is None or f is None:
                lines.append({"sample": sample, "metric": metric, "kind": "measured",
                              "baseline": b, "fix": f, "diff": None, "band": None, "band_source": None, "noise": None})
                continue
            if len(bv) > 1:
                band, source = max(bv) - min(bv), "spread"
            else:
                band, source = abs(b) * DEFAULT_BAND, "10%"
            diff = f - b
            lines.append({"sample": sample, "metric": metric, "kind": "measured",
                          "baseline": b, "fix": f, "diff": diff, "band": band, "band_source": source,
                          "noise": abs(diff) <= band + 1e-12})
    return {
        "mismatches": diffs,
        "lines": lines,
        "only_in_baseline": [s for s in bs if s not in fs],
        "only_in_fix": [s for s in fs if s not in bs],
        "no_baseline": no_baseline,
    }


def _num(v) -> str:
    if v is None:
        return "-"
    if isinstance(v, float) and not v.is_integer():
        return f"{v:.4g}"
    return f"{v:g}" if isinstance(v, float) else str(v)


def render(result: dict, base: dict, fix: dict) -> str:
    out = [f"baseline: {base['header'].get('plugin_commit')} ({base['header'].get('epochs')} epochs)",
           f"fix:      {fix['header'].get('plugin_commit')} ({fix['header'].get('epochs')} epochs)"]
    if result["mismatches"]:
        out.append("WARNING: compared despite differing " + "; ".join(result["mismatches"]))
    out += ["", "| sample | metric | baseline | fix | diff | band | moved |", "|---|---|---|---|---|---|---|"]
    for m in result["lines"]:
        if m["kind"] == "count":
            b = f"{m['baseline']}/{m['baseline_epochs']}"
            f = f"{m['fix']}/{m['fix_epochs']}"
            diff = f"{m['diff']:+d}"
            band, moved = "count", ("changed" if m["diff"] else "same")
        else:
            b, f = _num(m["baseline"]), _num(m["fix"])
            diff = "-" if m["diff"] is None else ("+" if m["diff"] >= 0 else "") + _num(m["diff"])
            band = "-" if m["band"] is None else f"{_num(m['band'])} ({m['band_source']})"
            moved = "-" if m["noise"] is None else ("noise" if m["noise"] else "MOVED")
        out.append(f"| {m['sample']} | {m['metric']} | {b} | {f} | {diff} | {band} | {moved} |")
    for s in result["only_in_baseline"]:
        out.append(f"\nonly in baseline: {s}")
    for s in result["only_in_fix"]:
        out.append(f"\nonly in fix: {s}")
    if result.get("no_baseline"):
        out += ["", "not gated (no baseline at this revision; freeze a fresh baseline epoch before gating on it)", "",
                "| sample | why | outcome_correct | false_pass | status_truthful |", "|---|---|---|---|---|"]
        for n in result["no_baseline"]:
            e = n["epochs"]
            out.append(f"| {n['sample']} | {n['reason']} | {n['outcome_correct']}/{e} | {n['false_pass']}/{e} | {n['status_truthful']}/{e} |")
    return "\n".join(out) + "\n"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("baseline", type=Path)
    p.add_argument("fix", type=Path)
    p.add_argument("--force", action="store_true", help="compare even if engine, Inspect or model differ")
    a = p.parse_args(argv)
    base, fix = json.loads(a.baseline.read_text()), json.loads(a.fix.read_text())
    try:
        result = compare(base, fix, force=a.force)
    except Mismatch as e:
        print(f"compare: {e}", file=sys.stderr)
        return 2
    sys.stdout.write(render(result, base, fix))
    return 0


if __name__ == "__main__":
    sys.exit(main())
