"""One command: run the dispatch suite with Inspect and write a scorecard.

    python graph-orchestrator/evals/run.py                      # paid: every role on claude-opus-5-5, 3 epochs
    python graph-orchestrator/evals/run.py --stub --epochs 1    # free dry run: canned engine, mockllm
    python graph-orchestrator/evals/run.py --from-log <file>    # rebuild a scorecard from a saved log

Writes out/scorecards/<plugin commit>-<UTC time>.json and .md (git-ignored);
raw Inspect logs go to logs/ (git-ignored). See README.md.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import suite  # noqa: E402
from scoring import Recorded, render_markdown, sample_row, scorecard  # noqa: E402


def plugin_commit() -> str:
    def git(*a: str) -> str:
        return subprocess.run(["git", "-C", str(suite.PLUGIN), *a], capture_output=True, text=True, check=True).stdout.strip()

    sha = git("rev-parse", "--short=12", "HEAD")
    dirty = git("status", "--porcelain", "--", str(suite.PLUGIN), str(suite.SKILLS))
    return f"{sha}-dirty" if dirty else sha


def recorded_from_log_sample(s) -> Recorded:
    st = s.store or {}
    return Recorded(
        result=st.get("harness_result") or {},
        trace=st.get("trace") or "",
        files=st.get("files") or {},
        sandbox_tree=st.get("sandbox_tree") or [],
        usage={m: u.model_dump() for m, u in (s.model_usage or {}).items()},
        after=st.get("after") or {},
    )


def engine_version(recs: list[Recorded]) -> str:
    seen = {
        str(((a.get("engine") or {}).get("init") or {}).get("claude_code_version"))
        for r in recs
        for a in (r.result.get("agents") or [])
        if isinstance(a.get("engine"), dict) and (a["engine"].get("init") or {}).get("claude_code_version")
    }
    extra = sorted(v for v in seen if v != suite.CLAUDE_CODE_VERSION)
    return suite.ENGINE_VERSION + (f" [observed {', '.join(extra)}]" if extra else "")


def build_scorecard(log, commit: str) -> dict:
    task_args = log.eval.task_args or {}
    samples = log.samples or []
    recs = [recorded_from_log_sample(s) for s in samples]
    rows = [
        sample_row(
            sample_id=str(s.id),
            epoch=s.epoch,
            rec=rec,
            check=suite.hidden_check(s.metadata),
            expected_status=s.metadata["expected_status"],
            hidden_names=[p.name for p in suite.hidden_files(s.metadata["fixture"])],
            pinned_model=suite.MODEL,
            limit_hit=getattr(getattr(s, "limit", None), "type", None),
        )
        for s, rec in zip(samples, recs)
    ]
    model = str(log.eval.model)
    header = {
        "plugin_commit": commit,
        "engine_version": engine_version(recs),
        "inspect_version": (log.eval.packages or {}).get("inspect_ai", "?"),
        "model": model.split("/", 1)[1] if model.startswith("anthropic/") else model,
        "concurrency_cap": task_args.get("cap", suite.DEFAULT_CAP),
        "cpus": task_args.get("cpus", suite.DEFAULT_CPUS),
        "memory": task_args.get("memory", suite.DEFAULT_MEMORY),
        "epochs": log.eval.config.epochs or task_args.get("epochs", suite.DEFAULT_EPOCHS),
        "cost_limit": task_args.get("cost_limit", suite.DEFAULT_COST_LIMIT),
        "time_limit": task_args.get("time_limit", suite.DEFAULT_TIME_LIMIT),
        "stub": bool(task_args.get("stub", False)),
        "created_at": log.eval.created,
        "log": Path(log.location).name if log.location else None,
    }
    return scorecard(header, rows)


def write_scorecard(card: dict, out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = out_dir / f"{card['header']['plugin_commit']}-{stamp}"
    j, m = base.with_suffix(".json"), base.with_suffix(".md")
    j.write_text(json.dumps(card, indent=2) + "\n")
    m.write_text(render_markdown(card))
    return j, m


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stub", action="store_true", help="canned engine and mockllm: no model call, no cost")
    ap.add_argument("--stub-delay-ms", type=int, default=0, help="with --stub: each canned answer takes this long, so queueing under the cap shows")
    ap.add_argument("--epochs", type=int, default=suite.DEFAULT_EPOCHS)
    ap.add_argument("--cap", type=int, default=suite.DEFAULT_CAP)
    ap.add_argument("--cpus", type=int, default=suite.DEFAULT_CPUS)
    ap.add_argument("--memory", default=suite.DEFAULT_MEMORY)
    ap.add_argument("--samples", default="", help="comma-separated sample ids (default: all)")
    ap.add_argument("--cost-limit", type=float, default=suite.DEFAULT_COST_LIMIT, help="per-sample dollar limit (Inspect cost_limit)")
    ap.add_argument("--time-limit", type=int, default=suite.DEFAULT_TIME_LIMIT, help="per-sample wall-clock seconds (Inspect time_limit)")
    ap.add_argument("--log-dir", default=str(suite.EVALS / "logs"))
    ap.add_argument("--out-dir", default=str(suite.EVALS / "out" / "scorecards"))
    ap.add_argument("--from-log", help="build the scorecard from this Inspect log instead of running")
    return ap


def main(argv: list[str] | None = None) -> int:
    a = build_parser().parse_args(argv)

    import inspect_ai
    from inspect_ai.log import read_eval_log

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

        from dispatch_suite import dispatch_suite

        task = dispatch_suite(
            stub=a.stub, cap=a.cap, cpus=a.cpus, memory=a.memory, epochs=a.epochs, samples=a.samples, cost_limit=a.cost_limit, time_limit=a.time_limit,
            stub_delay_ms=a.stub_delay_ms,
        )
        (log,) = inspect_eval(task, model="mockllm/model" if a.stub else f"anthropic/{suite.MODEL}", log_dir=a.log_dir)
        if log.location:
            log = read_eval_log(log.location)

    card = build_scorecard(log, plugin_commit())
    j, m = write_scorecard(card, Path(a.out_dir))
    print(render_markdown(card))
    print(f"scorecard: {j}\n           {m}")
    return 0 if log.status == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
