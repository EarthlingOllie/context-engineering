"""Scorers and the scorecard: pure functions from a recorded sample to metrics.

A recorded sample is what one dispatch eval leaves behind: the harness result
file, the trace file, the sandbox files the agents wrote, the sandbox file
tree as it stood before the agents ran, and Inspect's per-model usage. The
Inspect task builds one from the sandbox and the log; the tests build one from
a saved sample directory (tests/saved/<name>/). Nothing here imports Inspect
or calls a model.

Scoring is deterministic. A research sample's outcome is correct when every
planted fact is stated on one line together with the name of the file it comes
from, in the dispatch's returned result or in a file the agents wrote.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
import json

HEADER_FIELDS = ("plugin_commit", "engine_version", "inspect_version", "model", "concurrency_cap", "cpus", "memory", "epochs")


@dataclass
class Recorded:
    result: dict  # the harness result file (see harness/harness.ts HarnessResult)
    trace: str = ""  # the dispatch's trace file, as text
    files: dict[str, str] = field(default_factory=dict)  # sandbox path -> text, for files the agents wrote
    sandbox_tree: list[str] = field(default_factory=list)  # every sandbox path before the agents ran
    usage: dict[str, dict] = field(default_factory=dict)  # Inspect model_usage: model -> ModelUsage fields


def load_saved_sample(d: Path) -> Recorded:
    """A saved sample directory: result.json, trace.jsonl, usage.json, sandbox_tree.txt, files/<sandbox path>."""
    d = Path(d)
    files_root = d / "files"
    files = {}
    if files_root.is_dir():
        for p in sorted(files_root.rglob("*")):
            if p.is_file():
                files["/" + p.relative_to(files_root).as_posix()] = p.read_text()
    read = lambda name, default="": (d / name).read_text() if (d / name).exists() else default  # noqa: E731
    return Recorded(
        result=json.loads(read("result.json", "{}")),
        trace=read("trace.jsonl"),
        files=files,
        sandbox_tree=[l for l in read("sandbox_tree.txt").splitlines() if l.strip()],
        usage=json.loads(read("usage.json", "{}")),
    )


def _returned(rec: Recorded) -> dict:
    r = rec.result.get("return") if isinstance(rec.result, dict) else None
    return r if isinstance(r, dict) else {}


def _lines(rec: Recorded) -> list[str]:
    text = str(_returned(rec).get("result") or "")
    out = text.splitlines()
    for content in rec.files.values():
        out.extend(content.splitlines())
    return out


def outcome_correct(rec: Recorded, facts: list[dict]) -> tuple[bool, list[str]]:
    """Every planted fact stated with its file cited. Returns (correct, the facts not found)."""
    lines = [l.lower() for l in _lines(rec)]
    missing = []
    for f in facts:
        cite = f["file"].lower()
        pats = [re.compile(p, re.IGNORECASE) for p in f["patterns"]]
        if not any(cite in l and all(p.search(l) for p in pats) for l in lines):
            missing.append(f["fact"])
    return (not missing, missing)


def status_truthful(rec: Recorded, expected: str) -> bool:
    """The status the dispatch reported equals the status this sample must end in."""
    return _returned(rec).get("status") == expected


def hidden_check_absent(sandbox_tree: list[str], hidden_names: list[str]) -> bool:
    """No file of the hidden check was in the sandbox while the agents ran."""
    names = {n.lower() for n in hidden_names}
    return not any(Path(p).name.lower() in names for p in sandbox_tree)


def usage_metrics(usage: dict[str, dict]) -> dict:
    """Tokens and dollars summed over every model that served the sample.

    Dollars are Inspect's own `total_cost`, computed from the prices the task
    supplies; they are None when any model that ran has no price.
    `cache_write_share` is cache-write tokens over all input-side tokens
    (uncached input + cache write + cache read).
    """
    get = lambda u, k: int(u.get(k) or 0)  # noqa: E731
    inp = sum(get(u, "input_tokens") for u in usage.values())
    out = sum(get(u, "output_tokens") for u in usage.values())
    cr = sum(get(u, "input_tokens_cache_read") for u in usage.values())
    cw = sum(get(u, "input_tokens_cache_write") for u in usage.values())
    costs = [u.get("total_cost") for u in usage.values()]
    dollars = None if any(c is None for c in costs) else round(sum(costs), 6)
    side = inp + cr + cw
    return {
        "dollars": dollars,
        "input_tokens": inp,
        "output_tokens": out,
        "cache_read_tokens": cr,
        "cache_write_tokens": cw,
        "cache_write_share": round(cw / side, 4) if side else 0.0,
        "models": sorted(usage),
    }


def sample_row(*, sample_id: str, epoch: int, rec: Recorded, facts: list[dict], expected_status: str, hidden_names: list[str], pinned_model: str) -> dict:
    correct, missing = outcome_correct(rec, facts)
    u = usage_metrics(rec.usage)
    models = u.pop("models")
    wall = rec.result.get("wallClockMs")
    return {
        "sample": sample_id,
        "epoch": epoch,
        "outcome_correct": correct,
        "missing_facts": missing,
        "status_truthful": status_truthful(rec, expected_status),
        "reported_status": _returned(rec).get("status"),
        "expected_status": expected_status,
        **u,
        "agents": len(rec.result.get("agents") or []),
        "wall_clock_s": round(wall / 1000, 3) if isinstance(wall, (int, float)) else None,
        "models": models,
        "on_pinned_model": bool(models) and all(m.split("/")[-1] == pinned_model for m in models),
        "hidden_check_absent": hidden_check_absent(rec.sandbox_tree, hidden_names),
        "harness_error": rec.result.get("error"),
    }


def scorecard(header: dict, rows: list[dict]) -> dict:
    missing = [k for k in HEADER_FIELDS if header.get(k) in (None, "")]
    if missing:
        raise ValueError(f"scorecard header is missing: {', '.join(missing)}")
    return {"header": dict(header), "rows": list(rows)}


def _yn(v) -> str:
    return "-" if v is None else ("yes" if v else "no")


def render_markdown(card: dict) -> str:
    h = card["header"]
    out = ["# Dispatch evals scorecard", "", "| | |", "|---|---|"]
    out += [f"| {k} | {v} |" for k, v in h.items()]
    out += [
        "",
        "| sample | epoch | correct | truthful | reported | expected | $ | in | out | cache read | cache write | cw share | agents | wall s |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in card["rows"]:
        dollars = "-" if r["dollars"] is None else f"{r['dollars']:.4f}"
        wall = "-" if r["wall_clock_s"] is None else f"{r['wall_clock_s']:.1f}"
        out.append(
            f"| {r['sample']} | {r['epoch']} | {_yn(r['outcome_correct'])} | {_yn(r['status_truthful'])} | {r['reported_status']} | {r['expected_status']} "
            f"| {dollars} | {r['input_tokens']} | {r['output_tokens']} | {r['cache_read_tokens']} | {r['cache_write_tokens']} "
            f"| {r['cache_write_share'] * 100:.1f}% | {r['agents']} | {wall} |"
        )
    return "\n".join(out) + "\n"
