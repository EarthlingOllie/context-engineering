"""On demand: the concurrency sweep. Runs the two fan-out samples at each concurrency cap and prints one table.

    python graph-orchestrator/evals/sweep.py                                  # paid: samples 6 and 7 at caps 2, 4, 8 on 4 CPUs
    python graph-orchestrator/evals/sweep.py --stub --stub-delay-ms 300       # free dry run: canned engine, mockllm
    python graph-orchestrator/evals/sweep.py --caps 2,4,8,16 --cpus 8 --memory 16g
    python graph-orchestrator/evals/sweep.py --from-log <file>                # rebuild the table from a saved log

Not part of the routine run (run.py) or its budget. Writes out/sweeps/<plugin commit>-<UTC time>.json and .md
(git-ignored); raw Inspect logs go to logs/ (git-ignored). See README.md, "Concurrency sweep".
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import suite  # noqa: E402


def parse_caps(text: str) -> list[int]:
    caps = [int(c) for c in str(text).split(",") if c.strip()]
    if not caps or any(c < 1 for c in caps):
        raise ValueError(f"caps are positive integers, comma-separated, got {text!r}")
    return caps


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--caps", default=",".join(map(str, suite.DEFAULT_SWEEP_CAPS)), help="comma-separated concurrency caps")
    ap.add_argument("--cpus", type=int, default=suite.DEFAULT_CPUS)
    ap.add_argument("--memory", default=suite.DEFAULT_MEMORY)
    ap.add_argument("--epochs", type=int, default=suite.DEFAULT_SWEEP_EPOCHS, help="runs per sample and cap; the table shows their mean")
    ap.add_argument("--cost-limit", type=float, default=suite.DEFAULT_COST_LIMIT, help="per-run dollar limit (Inspect cost_limit)")
    ap.add_argument("--time-limit", type=int, default=suite.DEFAULT_TIME_LIMIT, help="per-run wall-clock seconds (Inspect time_limit)")
    ap.add_argument("--stub", action="store_true", help="canned engine and mockllm: no model call, no cost")
    ap.add_argument("--stub-delay-ms", type=int, default=0, help="with --stub: each canned answer takes this long, so queueing shows")
    ap.add_argument("--log-dir", default=str(suite.EVALS / "logs"))
    ap.add_argument("--out-dir", default=str(suite.EVALS / "out" / "sweeps"))
    ap.add_argument("--from-log", help="build the table from this Inspect log instead of running")
    return ap


def _mean(values: list) -> float | None:
    """The mean, or None when any value is missing (an unpriced model, a run with no wall clock)."""
    if not values or any(v is None for v in values):
        return None
    return round(sum(values) / len(values), 6)


def build_sweep(log, commit: str) -> dict:
    """The sweep's result from its Inspect log: a header (the caps, CPU count, memory and pins), the scorecard rows
    of every run, and the table: one row per sample and cap with wall clock, queue time and dollars, each the mean
    over that cell's epochs. `total_dollars` is what the whole pass cost (None if any run is unpriced)."""
    import run

    card = run.build_scorecard(log, commit)
    cells: dict[tuple[str, int], list[dict]] = {}
    for s, row in zip(log.samples or [], card["rows"]):
        cells.setdefault((s.metadata["sample"], int(s.metadata["cap"])), []).append(row)
    table = [
        {
            "sample": sample,
            "cap": cap,
            "epochs": len(rows),
            "wall_clock_s": _mean([r["wall_clock_s"] for r in rows]),
            "queue_s": _mean([r["queue_s"] for r in rows]),
            "dollars": _mean([r["dollars"] for r in rows]),
            "peak_concurrency": max(r["peak_concurrency"] for r in rows),
            "limit_hits": sum(1 for r in rows if r["limit_hit"]),
        }
        for (sample, cap), rows in sorted(cells.items())
    ]
    every = [r["dollars"] for r in card["rows"]]
    task_args = log.eval.task_args or {}
    header = {k: v for k, v in card["header"].items() if k != "concurrency_cap"}
    header = {
        **header,
        "caps": parse_caps(task_args.get("caps", ",".join(map(str, suite.DEFAULT_SWEEP_CAPS)))),
        "samples": list(suite.SWEEP_SAMPLES),
    }
    return {
        "header": header,
        "table": table,
        "total_dollars": None if not every or any(d is None for d in every) else round(sum(every), 6),
        "rows": card["rows"],
    }


def _num(v, fmt: str) -> str:
    return "-" if v is None else format(v, fmt)


def render_sweep_markdown(result: dict) -> str:
    out = ["# Concurrency sweep", "", "| | |", "|---|---|"]
    out += [f"| {k} | {v} |" for k, v in result["header"].items()]
    out += ["", "| sample | cap | wall clock s | queue s | $ | epochs |", "|---|---|---|---|---|---|"]
    for r in result["table"]:
        out.append(
            f"| {r['sample']} | {r['cap']} | {_num(r['wall_clock_s'], '.1f')} | {_num(r['queue_s'], '.1f')} | {_num(r['dollars'], '.4f')} | {r['epochs']} |"
        )
    out.append(f"| total | | | | {_num(result['total_dollars'], '.4f')} | |")
    return "\n".join(out) + "\n"


def write_sweep(result: dict, out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = out_dir / f"{result['header']['plugin_commit']}-{stamp}"
    j, m = base.with_suffix(".json"), base.with_suffix(".md")
    j.write_text(json.dumps(result, indent=2) + "\n")
    m.write_text(render_sweep_markdown(result))
    return j, m


def main(argv: list[str] | None = None) -> int:
    a = build_parser().parse_args(argv)
    caps = parse_caps(a.caps)

    import inspect_ai
    from inspect_ai.log import read_eval_log

    import run

    if inspect_ai.__version__ != suite.INSPECT_VERSION:
        print(f"inspect_ai {inspect_ai.__version__} is installed; the suite pins {suite.INSPECT_VERSION} (pip install -r requirements.txt)", file=sys.stderr)
        return 2
    if a.from_log:
        log = read_eval_log(a.from_log)
    else:
        if not a.stub and os.environ.get("ANTHROPIC_BASE_URL"):
            print("ANTHROPIC_BASE_URL is set: unset it so Inspect's provider calls the API directly (env -u ANTHROPIC_BASE_URL ...)", file=sys.stderr)
            return 2
        from inspect_ai import eval as inspect_eval

        from dispatch_suite import concurrency_sweep

        task = concurrency_sweep(
            caps=",".join(map(str, caps)), cpus=a.cpus, memory=a.memory, epochs=a.epochs, stub=a.stub,
            cost_limit=a.cost_limit, time_limit=a.time_limit, stub_delay_ms=a.stub_delay_ms,
        )
        (log,) = inspect_eval(task, model="mockllm/model" if a.stub else f"anthropic/{suite.MODEL}", log_dir=a.log_dir)
        if log.location:
            log = read_eval_log(log.location)

    result = build_sweep(log, run.plugin_commit())
    j, m = write_sweep(result, Path(a.out_dir))
    print(render_sweep_markdown(result))
    print(f"sweep: {j}\n       {m}")
    return 0 if log.status == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
