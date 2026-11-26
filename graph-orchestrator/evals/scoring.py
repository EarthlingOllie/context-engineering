"""Scorers and the scorecard: pure functions from a recorded sample to metrics.

A recorded sample is what one dispatch eval leaves behind: the harness result
file, the trace file, the sandbox files the agents wrote, the sandbox file
tree as it stood before the agents ran, and Inspect's per-model usage. The
Inspect task builds one from the sandbox and the log; the tests build one from
a saved sample directory (tests/saved/<name>/). Nothing here imports Inspect
or calls a model.

Scoring is deterministic. Each sample is scored by its hidden check
(suite.hidden_check), one of these kinds:

- `facts`: a research sample's outcome is correct when every planted fact is
  stated on one line together with the name of the file it comes from, in the
  dispatch's returned result (`source: result`) or also in a file the agents
  wrote (`source: result+files`);
- `blocked`: the dispatch returned `blocked` with a question that matches the
  check's patterns, and left the check's `unchanged` files as they were;
- `over_budget`: the dispatch returned `over_budget` and no dispatch agent ran;
- `tests`: the fixture's hidden tests, copied into the sandbox and run only
  after the dispatch finished, all passed (`Recorded.hidden_tests`);
- `exhausted`: the dispatch returned `exhausted` after the check's `rounds`;
- `chain_stop`: a chain stopped at the check's `stage` with its `status`,
  reported that stage and status, and ran no later stage.

Cost by role: each agent's role is read from its label, and its tokens from
its engine record, priced at the run's prices (the same ones Inspect gets).
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
    after: dict[str, str] = field(default_factory=dict)  # sandbox path -> text, for the fixture files after the agents ran
    hidden_tests: dict | None = None  # {"exit_code", "output"} of the hidden tests, run after the dispatch; None if not run


def load_saved_sample(d: Path) -> Recorded:
    """A saved sample directory: result.json, trace.jsonl, usage.json, sandbox_tree.txt,
    files/<sandbox path> (written by the agents), after/<sandbox path> (fixture files after the run),
    hidden_tests.json (the hidden-test run, if any)."""
    d = Path(d)

    def tree(name: str) -> dict[str, str]:
        root = d / name
        if not root.is_dir():
            return {}
        return {"/" + p.relative_to(root).as_posix(): p.read_text() for p in sorted(root.rglob("*")) if p.is_file()}

    read = lambda name, default="": (d / name).read_text() if (d / name).exists() else default  # noqa: E731
    return Recorded(
        result=json.loads(read("result.json", "{}")),
        trace=read("trace.jsonl"),
        files=tree("files"),
        after=tree("after"),
        sandbox_tree=[l for l in read("sandbox_tree.txt").splitlines() if l.strip()],
        usage=json.loads(read("usage.json", "{}")),
        hidden_tests=json.loads(read("hidden_tests.json", "null")),
    )


def _returned(rec: Recorded) -> dict:
    r = rec.result.get("return") if isinstance(rec.result, dict) else None
    return r if isinstance(r, dict) else {}


def _lines(rec: Recorded, with_files: bool = True) -> list[str]:
    text = str(_returned(rec).get("result") or "")
    out = text.splitlines()
    if with_files:
        for content in rec.files.values():
            out.extend(content.splitlines())
    return out


SCRIBE_LABEL = "Grapher"  # the plugin's label for its scribe (src/labels.ts)


def _is_scribe(a: dict) -> bool:
    return str(a.get("label") or "").startswith(SCRIBE_LABEL)


def dispatch_agents(rec: Recorded) -> list[dict]:
    """The agents the dispatch's topology ran: every agent but the scribe that writes its trace lines."""
    return [a for a in rec.result.get("agents") or [] if not _is_scribe(a)]


def queue_seconds(rec: Recorded) -> float:
    """Time agents spent waiting for a slot under the concurrency cap, summed over agents."""
    return round(sum(a.get("queuedMs") or 0 for a in rec.result.get("agents") or []) / 1000, 3)


def peak_concurrency(rec: Recorded) -> int:
    """The most agents that ran at once, from their start and end times."""
    edges = []
    for a in rec.result.get("agents") or []:
        if isinstance(a.get("startMs"), (int, float)) and isinstance(a.get("endMs"), (int, float)):
            edges += [(a["startMs"], 1), (a["endMs"], -1)]
    peak = running = 0
    for _, step in sorted(edges, key=lambda e: (e[0], e[1])):  # an end at t frees its slot before a start at t
        running += step
        peak = max(peak, running)
    return peak


def outcome_correct(rec: Recorded, facts: list[dict], with_files: bool = True) -> tuple[bool, list[str]]:
    """Every planted fact stated with its file cited. Returns (correct, the facts not found)."""
    lines = [l.lower() for l in _lines(rec, with_files)]
    missing = []
    for f in facts:
        cite = f["file"].lower()
        pats = [re.compile(p, re.IGNORECASE) for p in f["patterns"]]
        if not any(cite in l and all(p.search(l) for p in pats) for l in lines):
            missing.append(f["fact"])
    return (not missing, missing)


def outcome_blocked(rec: Recorded, check: dict) -> tuple[bool, list[str]]:
    """Blocked with a question that matches every pattern, and the `unchanged` files as they were."""
    ret = _returned(rec)
    if ret.get("status") != "blocked":
        return (False, [f"status {ret.get('status')}, not blocked"])
    why = []
    question = str(ret.get("question") or "").strip()
    if not question:
        why.append("no question asked")
    why += [f"question does not match {p}" for p in check.get("question_patterns", []) if not re.search(p, question, re.IGNORECASE)]
    why += [f"{path} was changed" for path, text in (check.get("unchanged") or {}).items() if rec.after.get(path) != text]
    return (not why, why)


def outcome_over_budget(rec: Recorded) -> tuple[bool, list[str]]:
    """over_budget, refused before any dispatch agent ran."""
    status = _returned(rec).get("status")
    if status != "over_budget":
        return (False, [f"status {status}, not over_budget"])
    n = len(dispatch_agents(rec))
    return (n == 0, [f"{n} dispatch agent(s) ran"] if n else [])


def pytest_counts(output: str) -> dict:
    """passed / failed / errors from pytest's summary line."""
    last = next((l for l in reversed(output.splitlines()) if l.strip()), "")
    count = lambda word: sum(int(n) for n in re.findall(rf"(\d+) {word}\b", last))  # noqa: E731
    return {"passed": count("passed"), "failed": count("failed"), "errors": count("errors?")}


def outcome_tests(rec: Recorded) -> tuple[bool, list[str]]:
    """Every hidden test passed (and at least one ran)."""
    run = rec.hidden_tests
    if not isinstance(run, dict):
        return (False, ["hidden tests did not run"])
    c = pytest_counts(str(run.get("output") or ""))
    code = run.get("exit_code")
    if code == 0 and c["passed"] > 0 and not c["failed"] and not c["errors"]:
        return (True, [])
    parts = [f"{c[k]} {k}" for k in ("failed", "errors") if c[k]] + [f"{c['passed']} passed"]
    return (False, [f"hidden tests: {', '.join(parts)} (exit {code})"])


def outcome_exhausted(rec: Recorded, check: dict) -> tuple[bool, list[str]]:
    """exhausted, after every round the check allows."""
    ret = _returned(rec)
    if ret.get("status") != "exhausted":
        return (False, [f"status {ret.get('status')}, not exhausted"])
    rounds = check["rounds"]
    return (True, []) if ret.get("iterations") == rounds else (False, [f"exhausted after {ret.get('iterations')} round(s), not {rounds}"])


_LINK = re.compile(r"^Link (\d+)")


def outcome_chain_stop(rec: Recorded, check: dict) -> tuple[bool, list[str]]:
    """The chain stopped at `stage` with `status`, said so in its stages and result, and ran no later stage."""
    ret = _returned(rec)
    status, stage = check["status"], check["stage"]
    if ret.get("status") != status:
        return (False, [f"status {ret.get('status')}, not {status}"])
    stage_id = f"{ret.get('id')}-s{stage}"
    why = []
    stages = ret.get("stages") or []
    if len(stages) != stage or stages[-1] != f"{stage_id}:{status}":
        why.append(f"stages reported {stages}, not stage {stage} last")
    if not str(ret.get("result") or "").startswith(f"stage {stage_id} {status}"):
        why.append(f"result does not name stage {stage_id} {status}")
    if any((m := _LINK.match(str(a.get("label") or ""))) and int(m.group(1)) > stage for a in rec.result.get("agents") or []):
        why.append(f"a stage after stage {stage} ran")
    return (not why, why)


def outcome(rec: Recorded, check: dict) -> tuple[bool, list[str]]:
    """The hidden check (see suite.hidden_check). Returns (correct, what failed)."""
    kind = check["kind"]
    if kind == "facts":
        return outcome_correct(rec, check["facts"], with_files=check.get("source", "result+files") != "result")
    if kind == "blocked":
        return outcome_blocked(rec, check)
    if kind == "over_budget":
        return outcome_over_budget(rec)
    if kind == "tests":
        return outcome_tests(rec)
    if kind == "exhausted":
        return outcome_exhausted(rec, check)
    if kind == "chain_stop":
        return outcome_chain_stop(rec, check)
    raise ValueError(f"unknown hidden check kind: {kind}")


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


_ROLE_WORDS = {"grapher": "scribe"}
_STAGE_PREFIX = re.compile(r"^Link [\d.]+(?: · [^,]+)?, ")


def role_of(label: str | None) -> str:
    """The role an agent label names (src/labels.ts): "Link 2 · Generator-evaluator, Evaluator (1 of 3): …" is an evaluator."""
    if not label:
        return "unlabelled"
    word = re.split(r"[ :(]", _STAGE_PREFIX.sub("", str(label)), maxsplit=1)[0].lower()
    return _ROLE_WORDS.get(word, word)


def _agent_usage(a: dict) -> dict[str, dict]:
    """Tokens one agent used, per model: the engine's per-model usage, else its total usage on the agent's model."""
    res = ((a.get("engine") or {}) if isinstance(a.get("engine"), dict) else {}).get("result") or {}
    get = lambda u, *ks: int(next((u[k] for k in ks if u.get(k) is not None), 0) or 0)  # noqa: E731
    per_model = res.get("modelUsage")
    if isinstance(per_model, dict) and per_model:
        return {
            m: {"input": get(u, "inputTokens"), "output": get(u, "outputTokens"), "cache_read": get(u, "cacheReadInputTokens"), "cache_write": get(u, "cacheCreationInputTokens")}
            for m, u in per_model.items()
        }
    u = res.get("usage")
    if isinstance(u, dict):
        return {str(a.get("model")): {"input": get(u, "input_tokens"), "output": get(u, "output_tokens"), "cache_read": get(u, "cache_read_input_tokens"), "cache_write": get(u, "cache_creation_input_tokens")}}
    return {}


def cost_by_role(rec: Recorded, prices: dict[str, dict] | None) -> dict[str, dict]:
    """Agents, dollars and tokens per role. Dollars are tokens at `prices` ($/MTok per model id); None for a role
    that used a model with no price."""
    out: dict[str, dict] = {}
    for a in rec.result.get("agents") or []:
        r = out.setdefault(role_of(a.get("label")), {"agents": 0, "dollars": 0.0, "input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0})
        r["agents"] += 1
        for model, t in _agent_usage(a).items():
            r["input_tokens"] += t["input"]
            r["output_tokens"] += t["output"]
            r["cache_read_tokens"] += t["cache_read"]
            r["cache_write_tokens"] += t["cache_write"]
            if not any(t.values()):
                continue
            p = (prices or {}).get(model.split("/")[-1])
            if p is None or r["dollars"] is None:
                r["dollars"] = None
                continue
            r["dollars"] += (t["input"] * p["input"] + t["output"] * p["output"] + t["cache_read"] * p["input_cache_read"] + t["cache_write"] * p["input_cache_write"]) / 1e6
    for r in out.values():
        if r["dollars"] is not None:
            r["dollars"] = round(r["dollars"], 6)
    return out


def sample_row(
    *,
    sample_id: str,
    epoch: int,
    rec: Recorded,
    check: dict,
    expected_status: str,
    hidden_names: list[str],
    pinned_model: str,
    limit_hit: str | None = None,
    prices: dict[str, dict] | None = None,
) -> dict:
    """One scorecard row. A sample that Inspect stopped at a limit (`limit_hit`:
    "cost", "time", ...) is reported as limit-hit: it is not scored, so it never
    counts as a failure of the plugin."""
    correct, missing = outcome(rec, check)
    truthful = status_truthful(rec, expected_status)
    if limit_hit:
        correct, missing, truthful = None, [], None
    u = usage_metrics(rec.usage)
    models = u.pop("models")
    wall = rec.result.get("wallClockMs")
    return {
        "sample": sample_id,
        "epoch": epoch,
        "outcome_correct": correct,
        "missing_facts": missing,
        "status_truthful": truthful,
        "limit_hit": limit_hit,
        "reported_status": _returned(rec).get("status"),
        "expected_status": expected_status,
        **u,
        "agents": len(dispatch_agents(rec)),
        "scribe": any(_is_scribe(a) for a in rec.result.get("agents") or []),
        "wall_clock_s": round(wall / 1000, 3) if isinstance(wall, (int, float)) else None,
        "queue_s": queue_seconds(rec),
        "peak_concurrency": peak_concurrency(rec),
        "models": models,
        "on_pinned_model": bool(models) and all(m.split("/")[-1] == pinned_model for m in models),
        "hidden_check_absent": hidden_check_absent(rec.sandbox_tree, hidden_names),
        "harness_error": rec.result.get("error"),
        "by_role": cost_by_role(rec, prices),
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
        "| sample | epoch | correct | truthful | reported | expected | $ | in | out | cache read | cache write | cw share | agents | wall s | queue s |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in card["rows"]:
        dollars = "-" if r["dollars"] is None else f"{r['dollars']:.4f}"
        wall = "-" if r["wall_clock_s"] is None else f"{r['wall_clock_s']:.1f}"
        queue = "-" if r.get("queue_s") is None else f"{r['queue_s']:.1f}"
        if r.get("limit_hit"):
            correct = truthful = f"limit-hit ({r['limit_hit']})"
        else:
            correct, truthful = _yn(r["outcome_correct"]), _yn(r["status_truthful"])
        out.append(
            f"| {r['sample']} | {r['epoch']} | {correct} | {truthful} | {r['reported_status']} | {r['expected_status']} "
            f"| {dollars} | {r['input_tokens']} | {r['output_tokens']} | {r['cache_read_tokens']} | {r['cache_write_tokens']} "
            f"| {r['cache_write_share'] * 100:.1f}% | {r['agents']} | {wall} | {queue} |"
        )
    roles = [(r, role, c) for r in card["rows"] for role, c in (r.get("by_role") or {}).items()]
    if roles:
        out += ["", "Cost by role", "", "| sample | epoch | role | agents | $ | in | out | cache read | cache write |", "|---|---|---|---|---|---|---|---|---|"]
        for r, role, c in roles:
            dollars = "-" if c["dollars"] is None else f"{c['dollars']:.4f}"
            out.append(
                f"| {r['sample']} | {r['epoch']} | {role} | {c['agents']} | {dollars} | {c['input_tokens']} | {c['output_tokens']} "
                f"| {c['cache_read_tokens']} | {c['cache_write_tokens']} |"
            )
    return "\n".join(out) + "\n"
