"""One command: run the session evals on demand and write a scorecard. Never part of the routine dispatch-eval run.

    python graph-orchestrator/evals/session/run.py                       # PAID: every scenario, 3 epochs, $8 a sample
    python graph-orchestrator/evals/session/run.py --plugin-ref v0.3.2   # PAID: the plugin as of a git ref
    python graph-orchestrator/evals/session/run.py --mock complies       # free: mockllm scripts the main loop
    python graph-orchestrator/evals/session/run.py --from-log <file>...  # rebuild a scorecard from saved logs
    python graph-orchestrator/evals/session/run.py --from-log <file> --save-records <dir>   # saved records for tests

Writes out/<plugin commit>-<UTC time>.json and .md (git-ignored); Inspect logs go to logs/. See ../README.md.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from budget import BUDGET_USD, DEFAULT_COST_LIMIT, DEFAULT_EPOCHS, SCENARIOS_IN_FULL_RUN  # noqa: E402
from records import record_from_store, save_record  # noqa: E402
from scorecard import render_markdown, row, scorecard  # noqa: E402
import scorers  # noqa: E402

MODEL = "claude-opus-5-5"
REPO = HERE.parents[2]


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--scenarios", default="", help="comma-separated scenario ids or directory names (default: all)")
    p.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    p.add_argument("--cost-limit", type=float, default=DEFAULT_COST_LIMIT, help="dollars per sample (Inspect cost_limit)")
    p.add_argument("--time-limit", type=int, default=3600, help="seconds per sample")
    p.add_argument("--plugin-ref", default="", help="install the plugin from this git ref instead of the working tree")
    p.add_argument("--mock", choices=("complies", "pushes", "silent"),
                   help="free: mockllm scripts the main loop (one scenario; pushes: hook, silent: blocked)")
    p.add_argument("--over-budget", action="store_true", help=f"run even if epochs x cost limit x scenarios exceeds ${BUDGET_USD:.0f}")
    p.add_argument("--from-log", nargs="+", type=Path, help="rebuild the scorecard from these Inspect logs; run nothing")
    p.add_argument("--save-records", type=Path, help="with --from-log: save each sample's records under this directory")
    p.add_argument("--log-dir", type=Path, default=HERE / "logs")
    p.add_argument("--out-dir", type=Path, default=HERE / "out")
    return p


def budget_problem(epochs: int, cost_limit: float, scenarios: int = SCENARIOS_IN_FULL_RUN, budget: float = BUDGET_USD) -> str | None:
    """A full run may spend at most epochs x cost limit x scenarios; refuse anything that could pass the budget."""
    worst = epochs * cost_limit * scenarios
    if worst > budget + 1e-9:
        return (f"{epochs} epochs x ${cost_limit:g} a sample x {scenarios} scenarios could spend ${worst:.2f}, "
                f"over the ${budget:.0f} budget; lower --epochs or --cost-limit, or pass --over-budget")
    return None


def epochs_for(session_cost: float, scenarios: int = SCENARIOS_IN_FULL_RUN, budget: float = BUDGET_USD) -> tuple[int, float | None]:
    """From ticket 01's cost of one session: the epochs that fit the budget and the per-sample cost limit that
    enforces it (budget / (epochs x scenarios), rounded down to the cent). (0, None): one epoch does not fit."""
    epochs = int(budget // (session_cost * scenarios))
    if epochs < 1:
        return 0, None
    return epochs, int(budget / (epochs * scenarios) * 100) / 100


def run_problem(a) -> str | None:
    if a.mock or a.from_log:
        return None
    if os.environ.get("ANTHROPIC_BASE_URL"):
        return "ANTHROPIC_BASE_URL is set; unset it for a paid run (env -u ANTHROPIC_BASE_URL ...)"
    if a.over_budget:
        return None
    return budget_problem(a.epochs, a.cost_limit, max(SCENARIOS_IN_FULL_RUN, len([s for s in a.scenarios.split(",") if s])))


def plugin_commit(ref: str = "") -> str:
    def git(*args: str) -> str:
        return subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True, check=True).stdout.strip()

    if ref:
        return git("rev-parse", "--short=12", ref)
    sha = git("rev-parse", "--short=12", "HEAD")
    return f"{sha}-dirty" if git("status", "--porcelain", "--", "graph-orchestrator") else sha


def build_scorecard(logs, commit: str) -> dict:
    import inspect_ai

    rows, versions = [], set()
    for lg in logs:
        for s in lg.samples or []:
            rec = record_from_store(s.store or {})
            scenario = (s.metadata or {}).get("scenario")
            limit = getattr(s, "limit", None)
            limit_hit = getattr(limit, "type", None) if limit else None
            # Rescored from the records with the current scorer, so a rebuilt scorecard follows scorer fixes.
            if scenario and rec.transcript:
                result = scorers.score(scenario, rec)
            else:
                result = {"passed": False, "checks": {}, "reasons": ["no records collected (setup error?)"]}
            r = row(str(s.id), s.epoch, result, rec, limit_hit=limit_hit,
                    wall_clock_s=getattr(s, "total_time", None))
            versions.add(r["claude_code_version"])
            rows.append(r)
    first = logs[0].eval
    meta = first.metadata or {}
    targs = first.task_args or {}
    header = {
        "model": MODEL if targs.get("mode", "mock") == "live" else f"mockllm ({targs.get('mock', 'complies')})",
        "claude_code_version": ", ".join(sorted(v for v in versions if v)) or meta.get("claude_code_version"),
        "plugin_commit": commit,
        "epochs": first.config.epochs or 1,
        "cost_limit": targs.get("cost_limit", DEFAULT_COST_LIMIT) if targs.get("mode") == "live" else "none (mock)",
        "inspect_version": inspect_ai.__version__,
        "plugin_ref": targs.get("plugin_ref") or "working tree",
        "time_limit": targs.get("time_limit"),
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "logs": [Path(lg.location).name for lg in logs],
    }
    return scorecard(header, rows)


def write_scorecard(card: dict, out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{card['header']['plugin_commit']}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    j, m = out_dir / f"{stem}.json", out_dir / f"{stem}.md"
    j.write_text(json.dumps(card, indent=2) + "\n")
    m.write_text(render_markdown(card))
    return j, m


def main(argv: list[str] | None = None) -> int:
    a = build_parser().parse_args(argv)
    problem = run_problem(a)
    if problem:
        print(f"session evals: {problem}", file=sys.stderr)
        return 2
    from inspect_ai import eval as inspect_eval
    from inspect_ai.log import read_eval_log

    if a.from_log:
        logs = [read_eval_log(str(p)) for p in a.from_log]
        if a.save_records:
            for lg in logs:
                for s in lg.samples or []:
                    save_record(record_from_store(s.store or {}), a.save_records / f"{s.id}-epoch{s.epoch}")
    else:
        from task import session_evals

        t = session_evals(scenarios=a.scenarios, mode="mock" if a.mock else "live", mock=a.mock or "complies",
                          cost_limit=a.cost_limit, time_limit=a.time_limit, plugin_ref=a.plugin_ref)
        logs = inspect_eval(t, model=None if a.mock else f"anthropic/{MODEL}", epochs=1 if a.mock else a.epochs,
                            log_dir=str(a.log_dir))
    card = build_scorecard(logs, plugin_commit(a.plugin_ref))
    j, m = write_scorecard(card, a.out_dir)
    sys.stdout.write(render_markdown(card))
    print(f"\nscorecard: {j}\n           {m}")
    return 0 if all(r["passed"] for r in card["rows"] if r["passed"] is not None) else 1


if __name__ == "__main__":
    sys.exit(main())
