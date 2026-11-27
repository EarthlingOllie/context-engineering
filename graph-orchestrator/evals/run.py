"""One command: run the dispatch suite with Inspect and write a scorecard.

    python graph-orchestrator/evals/run.py                      # paid: every role on claude-opus-5-5, 3 epochs
    python graph-orchestrator/evals/run.py --stub --epochs 1    # free dry run: canned engine, mockllm
    python graph-orchestrator/evals/run.py --from-log <file>    # rebuild a scorecard from a saved log
    python graph-orchestrator/evals/run.py --role-model evaluator=claude-haiku-5-5   # routing check: one role forced to Haiku
    python graph-orchestrator/evals/run.py --cut-to-one-epoch   # over budget: debate, best-of-n and relay at 1 epoch
    python graph-orchestrator/evals/run.py --baseline           # paid, one-off: freeze the baseline (5 epochs, every sample)

Writes out/scorecards/<plugin commit>-<UTC time>.json and .md (git-ignored), or, with --baseline,
baselines/<plugin commit>.json and .md (committed); raw Inspect logs go to logs/ (git-ignored). See README.md.
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
from scoring import HEADER_FIELDS, Recorded, render_markdown, sample_row, scorecard  # noqa: E402


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
        hidden_tests=st.get("hidden_tests"),
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


def _duration_s(logs) -> float | None:
    """Wall-clock seconds from the first log's start to the last log's end (Inspect's eval stats), if recorded."""
    spans = []
    for log in logs:
        st = getattr(log, "stats", None)
        if st is None or not getattr(st, "started_at", None) or not getattr(st, "completed_at", None):
            return None
        spans.append((datetime.fromisoformat(str(st.started_at)), datetime.fromisoformat(str(st.completed_at))))
    if not spans:
        return None
    return round((max(e for _, e in spans) - min(b for b, _ in spans)).total_seconds(), 3)


def build_scorecard(logs, commit: str) -> dict:
    """One scorecard from one Inspect log, or from several runs of the same task (--cut-to-one-epoch runs the cut
    samples as a second task at 1 epoch). The header comes from the first log; a sample run at other epochs is
    named in `epochs_by_sample`."""
    logs = list(logs) if isinstance(logs, (list, tuple)) else [logs]
    log = logs[0]
    task_args = log.eval.task_args or {}

    def log_epochs(lg) -> int:
        return lg.eval.config.epochs or (lg.eval.task_args or {}).get("epochs", suite.DEFAULT_EPOCHS)

    samples, epochs_of = [], {}
    for lg in logs:
        for s in lg.samples or []:
            samples.append(s)
            epochs_of[str(s.id)] = log_epochs(lg)
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
            prices=suite.PRICES,
            dispatch=(s.metadata.get("args") or {}).get("dispatch"),
        )
        for s, rec in zip(samples, recs)
    ]
    model = str(log.eval.model)
    epochs = log_epochs(log)
    header = {
        "plugin_commit": commit,
        "engine_version": engine_version(recs),
        "inspect_version": (log.eval.packages or {}).get("inspect_ai", "?"),
        "model": model.split("/", 1)[1] if model.startswith("anthropic/") else model,
        "concurrency_cap": task_args.get("cap", suite.DEFAULT_CAP),
        "cpus": task_args.get("cpus", suite.DEFAULT_CPUS),
        "memory": task_args.get("memory", suite.DEFAULT_MEMORY),
        "epochs": epochs,
        "cost_limit": task_args.get("cost_limit", suite.DEFAULT_COST_LIMIT),
        "time_limit": task_args.get("time_limit", suite.DEFAULT_TIME_LIMIT),
        "stub": bool(task_args.get("stub", False)),
        "role_models": suite.parse_role_models(task_args.get("role_models", "")),
        "sdk_version": suite.SDK_VERSION,
        "claude_code_version": suite.CLAUDE_CODE_VERSION,
        "pytest_version": suite.PYTEST_VERSION,
        "created_at": log.eval.created,
        "log": Path(log.location).name if log.location else None,
        "sample_revisions": {str(s.id): suite.sample_revision(s.metadata) for s in samples},
    }
    other = {sid: e for sid, e in epochs_of.items() if e != epochs}
    if other:
        header["epochs_by_sample"] = other
    if len(logs) > 1:
        header["logs"] = [Path(lg.location).name if lg.location else None for lg in logs]
    return scorecard(header, rows, duration_s=_duration_s(logs))


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
    ap.add_argument("--stub-evaluator", choices=["pass", "fail"], default="pass", help="with --stub: every evaluator passes, or fails (samples 5 and 9 then end exhausted, and sample 11 returns FAIL)")
    ap.add_argument(
        "--role-model", action="append", default=[], metavar="ROLE=MODEL",
        help="force a role onto another declared model through the harness (repeatable), e.g. evaluator=claude-haiku-5-5; the baseline forces none",
    )
    ap.add_argument("--stub-serve-model", default="", help="with --stub: report every call as served on this model (a dry run of the bridge falling back)")
    ap.add_argument("--epochs", type=int, default=suite.DEFAULT_EPOCHS, action=_Explicit)
    ap.add_argument("--cap", type=int, default=suite.DEFAULT_CAP)
    ap.add_argument("--cpus", type=int, default=suite.DEFAULT_CPUS)
    ap.add_argument("--memory", default=suite.DEFAULT_MEMORY)
    ap.add_argument("--samples", default="", help="comma-separated sample ids (default: all)")
    ap.add_argument("--cost-limit", type=float, default=suite.DEFAULT_COST_LIMIT, help="per-sample dollar limit (Inspect cost_limit)")
    ap.add_argument("--time-limit", type=int, default=suite.DEFAULT_TIME_LIMIT, help="per-sample wall-clock seconds (Inspect time_limit)")
    ap.add_argument("--log-dir", default=str(suite.EVALS / "logs"))
    ap.add_argument("--out-dir", default=str(suite.EVALS / "out" / "scorecards"))
    ap.add_argument("--from-log", nargs="+", help="build the scorecard from these Inspect logs (one run) instead of running")
    ap.add_argument(
        "--cut-to-one-epoch", action="store_true",
        help=f"run {', '.join(suite.CUT_TO_ONE_EPOCH)} at 1 epoch and the rest at --epochs (the rule for a run over the ${suite.ROUTINE_BUDGET:.0f} budget)",
    )
    ap.add_argument(
        "--baseline", action="store_true",
        help=f"freeze the baseline: every sample, every role on {suite.MODEL}, {suite.BASELINE_EPOCHS} epochs, written to baselines/<plugin commit>.json; "
        "refused if the plugin or skills have uncommitted changes or change during the run",
    )
    return ap


class _Explicit(argparse.Action):
    """Stores the value and records that it was given on the command line (the baseline refuses an explicit --epochs)."""

    def __call__(self, parser, namespace, values, option_string=None):
        setattr(namespace, self.dest, values)
        setattr(namespace, f"_{self.dest}_given", True)


def resolve_baseline(a) -> str | None:
    """With --baseline: refuse anything that is not the untouched plugin on every sample with every role on the pinned
    model, and set 5 epochs and the baselines/ directory. Returns why it refuses, or None."""
    if not a.baseline:
        return None
    bad = [
        flag for flag, given in (
            ("--stub", a.stub), ("--role-model", a.role_model), ("--stub-serve-model", a.stub_serve_model), ("--samples", a.samples),
            ("--cut-to-one-epoch", a.cut_to_one_epoch), ("--epochs", getattr(a, "_epochs_given", False)), ("--from-log", a.from_log),
        ) if given
    ]
    if bad:
        return f"--baseline runs every sample at {suite.BASELINE_EPOCHS} epochs with every role on {suite.MODEL}; it cannot take {', '.join(bad)}"
    a.epochs = suite.BASELINE_EPOCHS
    if a.out_dir == str(suite.EVALS / "out" / "scorecards"):
        a.out_dir = str(suite.BASELINES)
    return None


def epoch_plan(a) -> list[tuple[int, list[str]]]:
    """(epochs, sample ids) per Inspect task to run: every selected sample at --epochs, or, with --cut-to-one-epoch,
    debate, best-of-n and relay at 1 epoch in a second task."""
    wanted = {x for x in (a.samples or "").split(",") if x}
    ids = [s["id"] for s in suite.load_samples() if not wanted or s["id"] in wanted]
    if not a.cut_to_one_epoch:
        return [(a.epochs, ids)]
    plan = [(a.epochs, [i for i in ids if i not in suite.CUT_TO_ONE_EPOCH]), (1, [i for i in ids if i in suite.CUT_TO_ONE_EPOCH])]
    return [(e, xs) for e, xs in plan if xs]


def baseline_refusal(before: str, after: str) -> str | None:
    """Why a run cannot be frozen as the baseline, given the plugin commit before and after it, or None."""
    if before.endswith("-dirty") or after.endswith("-dirty"):
        return "the plugin or skills have uncommitted changes: commit them, then freeze the baseline"
    if before != after:
        return f"the plugin commit changed during the run ({before} -> {after}): the baseline must run on one untouched commit"
    return None


def write_baseline(card: dict, out_dir: Path) -> tuple[Path, Path]:
    """baselines/<plugin commit>.json and .md; never overwrites a frozen baseline."""
    out_dir.mkdir(parents=True, exist_ok=True)
    base = out_dir / card["header"]["plugin_commit"]
    j, m = base.with_suffix(".json"), base.with_suffix(".md")
    if j.exists() or m.exists():
        raise FileExistsError(f"a baseline for {card['header']['plugin_commit']} is already frozen: {j}")
    j.write_text(json.dumps(card, indent=2) + "\n")
    m.write_text(render_markdown(card))
    return j, m


def plugin_source_pathspec() -> list[str]:
    """The plugin source a baseline measures, relative to the repo: the plugin and the skills it installs, not the
    evals (a committed baseline lives there)."""
    plugin = suite.PLUGIN.relative_to(suite.REPO).as_posix()
    evals = suite.EVALS.relative_to(suite.REPO).as_posix()
    return [plugin, f":(exclude){evals}", suite.SKILLS.relative_to(suite.REPO).as_posix()]


def plugin_source_changes(since: str, until: str = "HEAD") -> list[str]:
    """Plugin source files that differ between two commits (empty: the plugin is untouched between them)."""
    out = subprocess.run(
        ["git", "-C", str(suite.REPO), "diff", "--name-only", since, until, "--", *plugin_source_pathspec()],
        capture_output=True, text=True, check=True,
    ).stdout
    return [line for line in out.splitlines() if line]


BASELINE_HEADER = (
    *HEADER_FIELDS, "cost_limit", "time_limit", "stub", "role_models", "sdk_version", "claude_code_version", "pytest_version", "created_at",
)


def stale_samples(card: dict) -> list[str]:
    """The current samples a baseline holds no rows for at their current revision: added or revised since it was
    frozen (a sample's `revision`, recorded in the header's `sample_revisions`; a baseline that records none ran
    revision 1 of every sample it has rows for). compare.py reports them ungated; freeze a fresh baseline epoch
    before gating on them."""
    h = card.get("header") or {}
    have = {r["sample"] for r in card.get("rows") or []}
    recorded = h.get("sample_revisions")
    out = []
    for s in suite.load_samples():
        base = recorded.get(s["id"], 0) if recorded is not None else (1 if s["id"] in have else 0)
        if base != suite.sample_revision(s):
            out.append(s["id"])
    return out


def baseline_problems(card: dict, file_name: str) -> list[str]:
    """What keeps a scorecard from being the frozen baseline: the full version header, the frozen configuration (no
    stub, no forced role, the pinned model, Inspect and engine, 5 epochs), every sample at every epoch, the spread,
    and a file named after its clean plugin commit. A sample added or revised since the baseline (stale_samples) is
    not required."""
    h, problems = card.get("header") or {}, []
    missing = [k for k in BASELINE_HEADER if k not in h or h[k] is None or h[k] == ""]
    if missing:
        problems.append(f"header is missing {', '.join(missing)}")
    expect = {"epochs": suite.BASELINE_EPOCHS, "stub": False, "role_models": {}, "model": suite.MODEL, "inspect_version": suite.INSPECT_VERSION}
    problems += [f"header {k} is {h.get(k)!r}, the baseline needs {v!r}" for k, v in expect.items() if k in h and h[k] != v]
    if h.get("engine_version") and not str(h["engine_version"]).startswith(suite.ENGINE_VERSION):
        problems.append(f"header engine_version is {h['engine_version']!r}, the pin is {suite.ENGINE_VERSION!r}")
    if h.get("epochs_by_sample"):
        problems.append(f"epochs_by_sample {h['epochs_by_sample']}: every sample runs every epoch in the baseline")
    commit = str(h.get("plugin_commit") or "")
    if commit.endswith("-dirty"):
        problems.append(f"plugin_commit {commit} has uncommitted changes")
    if file_name != f"{commit}.json":
        problems.append(f"file name {file_name} is not <plugin commit>.json ({commit}.json)")
    epochs: dict[str, set] = {}
    for r in card.get("rows") or []:
        epochs.setdefault(r["sample"], set()).add(r["epoch"])
    stale = set(stale_samples(card))
    for s in suite.load_samples():
        if s["id"] in stale:
            continue
        got = epochs.get(s["id"], set())
        if got != set(range(1, suite.BASELINE_EPOCHS + 1)):
            problems.append(f"{s['id']} has epochs {sorted(got)}, not 1-{suite.BASELINE_EPOCHS}")
    if set((card.get("spread") or {})) != set(epochs):
        problems.append("spread does not cover exactly the samples in the rows")
    return problems




def main(argv: list[str] | None = None) -> int:
    a = build_parser().parse_args(argv)
    refusal = resolve_baseline(a)
    if refusal:
        print(refusal, file=sys.stderr)
        return 2

    import inspect_ai
    from inspect_ai.log import read_eval_log

    if inspect_ai.__version__ != suite.INSPECT_VERSION:
        print(f"inspect_ai {inspect_ai.__version__} is installed; the suite pins {suite.INSPECT_VERSION} (pip install -r requirements.txt)", file=sys.stderr)
        return 2

    before = plugin_commit()
    if a.baseline and (refusal := baseline_refusal(before, before)):
        print(f"--baseline: {refusal}", file=sys.stderr)
        return 2

    if a.from_log:
        logs = [read_eval_log(f) for f in a.from_log]
    else:
        if not a.stub and os.environ.get("ANTHROPIC_BASE_URL"):
            print("ANTHROPIC_BASE_URL is set: unset it so Inspect's provider calls the API directly (env -u ANTHROPIC_BASE_URL ...)", file=sys.stderr)
            return 2
        from inspect_ai import eval as inspect_eval

        from dispatch_suite import dispatch_suite

        tasks = [
            dispatch_suite(
                stub=a.stub, cap=a.cap, cpus=a.cpus, memory=a.memory, epochs=epochs, samples=",".join(ids), cost_limit=a.cost_limit,
                time_limit=a.time_limit, stub_delay_ms=a.stub_delay_ms, stub_evaluator=a.stub_evaluator,
                role_models=",".join(f"{r}={m}" for r, m in suite.parse_role_models(a.role_model).items()), stub_serve_model=a.stub_serve_model,
            )
            for epochs, ids in epoch_plan(a)
        ]
        logs = inspect_eval(tasks, model="mockllm/model" if a.stub else f"anthropic/{suite.MODEL}", log_dir=a.log_dir)
        logs = [read_eval_log(lg.location) if lg.location else lg for lg in logs]

    after = plugin_commit()
    card = build_scorecard(logs, after)
    print(render_markdown(card))
    ok = all(lg.status == "success" for lg in logs)
    if a.baseline:
        refusal = baseline_refusal(before, after) or (None if ok else "the run did not finish successfully")
        if refusal:
            j, m = write_scorecard(card, suite.EVALS / "out" / "scorecards")
            print(f"--baseline: not frozen: {refusal}\nscorecard: {j}\n           {m}", file=sys.stderr)
            return 2
        j, m = write_baseline(card, Path(a.out_dir))
        print(f"baseline: {j}\n          {m}\ncommit both files; compare a later run with compare.py {j} <its scorecard>.json")
        return 0
    j, m = write_scorecard(card, Path(a.out_dir))
    print(f"scorecard: {j}\n           {m}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
