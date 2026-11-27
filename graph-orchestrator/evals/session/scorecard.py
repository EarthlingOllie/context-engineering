"""The session-eval scorecard: the dispatch-eval scorecard's shape (header, one row per sample and epoch,
per-sample spread over epochs) with the session header (model, Claude Code version, plugin commit, epochs,
cost limit) and each scenario's pass rate. A row's `outcome_correct` mirrors `passed`, so compare.py reads two
session scorecards as it reads two dispatch-eval ones. Pure: no Inspect import.
"""

from __future__ import annotations

from records import SessionRecord, session_facts

HEADER_FIELDS = ("model", "claude_code_version", "plugin_commit", "epochs", "cost_limit")
MEASURED = ("dollars", "wall_clock_s", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "turns")


def row(sample: str, epoch: int, result: dict, rec: SessionRecord, *, limit_hit: str | None = None,
        wall_clock_s: float | None = None) -> dict:
    """One scorecard row. A sample stopped at its cost or time limit is not scored (passed is None)."""
    facts = session_facts(rec)
    scored = limit_hit is None
    return {
        "sample": sample,
        "epoch": epoch,
        "passed": bool(result["passed"]) if scored else None,
        "outcome_correct": bool(result["passed"]) if scored else None,
        "checks": result.get("checks") or {},
        "reasons": result.get("reasons") or [],
        "limit_hit": limit_hit,
        "claude_code_version": facts["claude_code_version"],
        "dollars": facts["dollars"],
        "wall_clock_s": wall_clock_s if wall_clock_s is not None else facts["duration_s"],
        "turns": facts["turns"],
        "input_tokens": facts["input_tokens"],
        "output_tokens": facts["output_tokens"],
        "cache_read_tokens": facts["cache_read_tokens"],
        "cache_write_tokens": facts["cache_write_tokens"],
    }


def _by_sample(rows: list[dict]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["sample"], []).append(r)
    return out


def pass_rate(rows: list[dict]) -> dict:
    out = {}
    for sample, rs in _by_sample(rows).items():
        scored = [r for r in rs if r.get("passed") is not None]
        passed = sum(1 for r in scored if r["passed"])
        out[sample] = {"passed": passed, "scored": len(scored), "rate": f"{passed}/{len(scored)}",
                       "limit_hits": sum(1 for r in rs if r.get("limit_hit"))}
    return out


def spread(rows: list[dict]) -> dict:
    """Per sample, for each measured metric: min, max, spread (max - min, compare.py's noise band) and n."""
    out = {}
    for sample, rs in _by_sample(rows).items():
        d: dict = {"epochs": len(rs)}
        for m in MEASURED:
            vs = [r[m] for r in rs if r.get(m) is not None]
            d[m] = {"min": min(vs), "max": max(vs), "spread": round(max(vs) - min(vs), 6), "n": len(vs)} if vs else None
        out[sample] = d
    return out


def scorecard(header: dict, rows: list[dict]) -> dict:
    missing = [k for k in HEADER_FIELDS if header.get(k) in (None, "")]
    if missing:
        raise ValueError(f"session scorecard header is missing: {', '.join(missing)}")
    ds = [r.get("dollars") for r in rows]
    return {
        "header": dict(header),
        "rows": list(rows),
        "pass_rate": pass_rate(rows),
        "spread": spread(rows),
        "run_cost": {"dollars": None if not ds or None in ds else round(sum(ds), 6)},
    }


def render_markdown(card: dict) -> str:
    out = ["# Session evals scorecard", "", "| | |", "|---|---|"]
    out += [f"| {k} | {v} |" for k, v in card["header"].items()]
    out += ["", "Pass rate per scenario (passed / scored epochs; limit-hit epochs are not scored)", "",
            "| scenario | pass rate | limit hits |", "|---|---|---|"]
    out += [f"| {s} | {p['rate']} | {p['limit_hits']} |" for s, p in card["pass_rate"].items()]

    def rng(v, fmt: str) -> str:
        return "-" if not v else f"{v['min']:{fmt}}-{v['max']:{fmt}} ({v['spread']:{fmt}})"

    out += ["", "Run-to-run spread per scenario (min-max over its epochs, spread in brackets)", "",
            "| scenario | epochs | $ | wall s | input tokens | output tokens |", "|---|---|---|---|---|---|"]
    for s, d in card["spread"].items():
        out.append(f"| {s} | {d['epochs']} | {rng(d['dollars'], '.4f')} | {rng(d['wall_clock_s'], '.1f')} "
                   f"| {rng(d['input_tokens'], 'g')} | {rng(d['output_tokens'], 'g')} |")
    out += ["", "| scenario | epoch | result | failed checks | $ |", "|---|---|---|---|---|"]
    for r in card["rows"]:
        verdict = f"limit-hit ({r['limit_hit']})" if r.get("limit_hit") else ("pass" if r["passed"] else "fail")
        failed = ", ".join(k for k, v in r["checks"].items() if not v) or "-"
        dollars = "-" if r.get("dollars") is None else f"{r['dollars']:.4f}"
        out.append(f"| {r['sample']} | {r['epoch']} | {verdict} | {failed} | {dollars} |")
    total = card["run_cost"]["dollars"]
    out += ["", f"Run cost: {'unknown' if total is None else f'${total:.2f}'} (Claude Code's own list-price totals)."]
    return "\n".join(out) + "\n"
