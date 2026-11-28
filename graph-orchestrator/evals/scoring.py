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
  after the dispatch finished, all passed (`Recorded.hidden_tests`; pytest's
  summary line, or the TAP summary of Node's test runner for `runner: node`);
- `exhausted`: the dispatch returned `exhausted` after the check's `rounds`;
- `chain_stop`: a chain stopped at the check's `stage` with its `status`,
  reported that stage and status (a `<stage id> <status>:` stage line, or
  the older `stage <stage id> <status>` first line), and ran no later stage;
- `verdict`: a panel returned `done` with the check's verdict (`FAIL`) on its
  first line and a `[<lens>] FAIL` line for the check's `lens`, the lens the
  planted defect belongs to;
- `coverage`: an iterative fan-out returned `done` after exactly the check's
  `rounds`, and its returned result states every planted fact with its file;
- `chosen_tests`: a best-of-n returned `done`, its judge chose a candidate, and
  the hidden tests, run on the fixture with that candidate's copy laid over it,
  all passed;
- `contract_verdict`: the dispatch returned `done` with exactly one of the
  check's `options` on its first line, within the return contract's lines;
- `relay`: a relay returned `done` within the check's `sessions`, every worker
  session rewrote the `progress` file (its hash, taken by the harness before
  and after each agent, changed), and the hidden tests all passed.

A false pass is a scored row whose dispatch returned `done` while its hidden
check failed; the scorecard counts them per sample and for the suite.

Cost by role: each agent's role is read from its label, and its tokens from
its engine record, priced at the run's prices (the same ones Inspect gets).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
import json

from suite import CUT_TO_ONE_EPOCH, ROUTINE_BUDGET, catalog_demand

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
CHECKER_LABEL = "Checker"  # the plugin's label for its artifact checker (src/labels.ts), run after the topology returns


def _is_scribe(a: dict) -> bool:
    return str(a.get("label") or "").startswith(SCRIBE_LABEL)


def _is_engine_agent(a: dict) -> bool:
    """The scribe and the artifact checker: agents the engine runs around the topology, not the topology's own."""
    return _is_scribe(a) or str(a.get("label") or "").startswith(CHECKER_LABEL)


def dispatch_agents(rec: Recorded) -> list[dict]:
    """The agents the dispatch's topology ran: every agent but the scribe that writes its trace lines and the
    artifact checker that tests the claimed artifacts exist."""
    return [a for a in rec.result.get("agents") or [] if not _is_engine_agent(a)]


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


_TAP_COUNT = re.compile(r"^# (pass|fail|cancelled) (\d+)\s*$", re.MULTILINE)


def hidden_test_counts(output: str) -> dict:
    """passed / failed / errors from Node's test runner TAP summary (`# pass N`, `# fail N`, `# cancelled N`), else pytest's."""
    tap = {k: int(n) for k, n in _TAP_COUNT.findall(output)}
    if "pass" in tap:
        return {"passed": tap["pass"], "failed": tap.get("fail", 0), "errors": tap.get("cancelled", 0)}
    return pytest_counts(output)


def outcome_tests(rec: Recorded) -> tuple[bool, list[str]]:
    """Every hidden test passed (and at least one ran)."""
    run = rec.hidden_tests
    if not isinstance(run, dict):
        return (False, ["hidden tests did not run"])
    c = hidden_test_counts(str(run.get("output") or ""))
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
    result = str(ret.get("result") or "")
    if not (result.startswith(f"stage {stage_id} {status}") or any(l.startswith(f"{stage_id} {status}:") for l in result.splitlines())):
        why.append(f"result does not name stage {stage_id} {status}")
    if any((m := _LINK.match(str(a.get("label") or ""))) and int(m.group(1)) > stage for a in rec.result.get("agents") or []):
        why.append(f"a stage after stage {stage} ran")
    return (not why, why)


def outcome_verdict(rec: Recorded, check: dict) -> tuple[bool, list[str]]:
    """A panel's verdict: done, the check's verdict first, and the defect's lens named on a `[lens] FAIL` line."""
    ret = _returned(rec)
    if ret.get("status") != "done":
        return (False, [f"status {ret.get('status')}, not done"])
    lines = str(ret.get("result") or "").splitlines()
    first = lines[0].strip() if lines else ""
    want = check["verdict"]
    if not first.upper().startswith(want.upper()):
        return (False, [f"verdict {first.split(' ')[0] or '(none)'}, not {want}"])
    lens = re.compile(rf"^\s*\[{re.escape(check['lens'])}\]\s*FAIL\b", re.IGNORECASE)
    if not any(lens.match(l) for l in lines[1:]):
        return (False, [f"{want} verdict does not name the {check['lens']} lens"])
    return (True, [])


def outcome_coverage(rec: Recorded, check: dict) -> tuple[bool, list[str]]:
    """Done after exactly `rounds` rounds, with every planted fact in the returned result."""
    ret = _returned(rec)
    if ret.get("status") != "done":
        return (False, [f"status {ret.get('status')}, not done"])
    _, missing = outcome_correct(rec, check["facts"], with_files=False)
    why = [] if ret.get("iterations") == check["rounds"] else [f"done after {ret.get('iterations')} round(s), not {check['rounds']}"]
    why += missing
    return (not why, why)


_CANDIDATE = re.compile(r"\[(\d+)\]")


def chosen_candidate(rec: Recorded) -> int | None:
    """The candidate a best-of-n's judge chose, as the plugin reads it: the judge's `chosen` index, else the first
    `[i]` its verdict names; None when it named none."""
    judge = next((a for a in rec.result.get("agents") or [] if (a.get("role") or role_of(a.get("label"))) == "judge"), None)
    out = judge.get("output") if judge else None
    chosen = out.get("chosen") if isinstance(out, dict) else None
    if isinstance(chosen, int) and not isinstance(chosen, bool) and chosen >= 1:
        return chosen
    m = _CANDIDATE.search(str(_returned(rec).get("result") or ""))
    return int(m.group(1)) if m else None


def outcome_chosen_tests(rec: Recorded) -> tuple[bool, list[str]]:
    """Done, a chosen candidate, and the hidden tests run on that candidate all passed."""
    ret = _returned(rec)
    if ret.get("status") != "done":
        return (False, [f"status {ret.get('status')}, not done"])
    chosen = chosen_candidate(rec)
    if chosen is None:
        return (False, ["the judge named no candidate"])
    ran_on = (rec.hidden_tests or {}).get("candidate") if isinstance(rec.hidden_tests, dict) else None
    if ran_on != chosen:
        return (False, [f"hidden tests ran on candidate {ran_on}, not the chosen candidate {chosen}"])
    ok, why = outcome_tests(rec)
    return (ok, [f"candidate {chosen}: {w}" for w in why])


def outcome_contract_verdict(rec: Recorded, check: dict) -> tuple[bool, list[str]]:
    """Done, exactly one of `options` named on line 1, and no more lines than the contract's `max_lines`."""
    ret = _returned(rec)
    if ret.get("status") != "done":
        return (False, [f"status {ret.get('status')}, not done"])
    lines = str(ret.get("result") or "").strip().splitlines()
    options = check["options"]
    named = [o for o in options if lines and re.search(rf"\b{re.escape(o)}\b", lines[0], re.IGNORECASE)]
    if not named:
        return (False, [f"line 1 names none of {', '.join(options)}"])
    if len(named) > 1:
        return (False, [f"line 1 names more than one of {', '.join(options)}"])
    limit = check.get("max_lines")
    if limit and len(lines) > limit:
        return (False, [f"{len(lines)} lines, past the {limit}-line contract"])
    return (True, [])


def outcome_relay(rec: Recorded, check: dict) -> tuple[bool, list[str]]:
    """Done within `sessions`, every worker session rewrote the `progress` file, and the hidden tests passed."""
    ret = _returned(rec)
    why = [] if ret.get("status") == "done" else [f"status {ret.get('status')}, not done"]
    if ret.get("status") == "done" and (ret.get("iterations") or 0) > check["sessions"]:
        why.append(f"done after {ret.get('iterations')} session(s), more than {check['sessions']}")
    path = check["progress"]
    workers = [a for a in dispatch_agents(rec) if (a.get("role") or role_of(a.get("label"))) == "worker"]
    for s, a in enumerate(workers, 1):
        w = (a.get("watched") or {}).get(path) or {}
        if not w.get("after") or w.get("after") == w.get("before"):
            why.append(f"session {s} did not rewrite {path}")
    if not workers:
        why.append("no worker session ran")
    ok, tests_why = outcome_tests(rec)
    why += tests_why
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
    if kind == "verdict":
        return outcome_verdict(rec, check)
    if kind == "coverage":
        return outcome_coverage(rec, check)
    if kind == "chosen_tests":
        return outcome_chosen_tests(rec)
    if kind == "contract_verdict":
        return outcome_contract_verdict(rec, check)
    if kind == "relay":
        return outcome_relay(rec, check)
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


def _model_id(name) -> str:
    """A model name without its provider prefix: "anthropic/claude-opus-5-5" is "claude-opus-5-5"."""
    return str(name).split("/")[-1]


def served_models(a: dict) -> list[str]:
    """The models that served one agent's calls: each call's reported model (the engine records it per call), else
    the models in the engine's per-model usage. Empty when the engine reported neither."""
    eng = a.get("engine") if isinstance(a.get("engine"), dict) else {}
    calls = [c.get("model") for c in eng.get("calls") or [] if isinstance(c, dict) and c.get("model")]
    if calls:
        return [_model_id(m) for m in calls]
    return [_model_id(m) for m in ((eng.get("result") or {}).get("modelUsage") or {})]


def model_routing(rec: Recorded) -> dict:
    """Per role, the models its agents were requested on and the models that served their calls; and every agent
    with a call served by another model than the one it requested (the bridge's silent fallback, spec: Model routing).
    An agent whose engine reported no serving model is not counted as misrouted."""
    by: dict[str, dict] = {}
    misrouted = []
    for a in rec.result.get("agents") or []:
        role = a.get("role") or role_of(a.get("label"))
        requested = _model_id(a.get("model"))
        served = served_models(a)
        r = by.setdefault(role, {"requested": set(), "served": set()})
        r["requested"].add(requested)
        r["served"].update(served)
        wrong = sorted({m for m in served if m != requested})
        if wrong:
            misrouted.append({"agent": a.get("n"), "role": role, "requested": requested, "served": wrong})
    return {"by_role": {k: {"requested": sorted(v["requested"]), "served": sorted(v["served"])} for k, v in by.items()}, "misrouted": misrouted}


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
    dispatch: dict | None = None,
) -> dict:
    """One scorecard row. A sample that Inspect stopped at a limit (`limit_hit`:
    "cost", "time", ...) is reported as limit-hit: it is not scored, so it never
    counts as a failure of the plugin. `dispatch` (the sample's dispatch spec)
    gives the row's `demand`, the catalog's formula for it, to set against `agents`."""
    correct, missing = outcome(rec, check)
    truthful = status_truthful(rec, expected_status)
    reported = _returned(rec).get("status")
    false_pass = reported == "done" and not correct
    # A call served by another model than requested fails the sample, whatever its hidden check says.
    routing = model_routing(rec)
    routing_ok = not routing["misrouted"]
    if not routing_ok:
        correct = False
        missing = list(missing) + [
            f"model routing: {m['role']} agent {m['agent']} requested {m['requested']}, served by {', '.join(m['served'])}" for m in routing["misrouted"]
        ]
    if limit_hit:
        correct, missing, truthful, false_pass, routing_ok = None, [], None, None, None
    u = usage_metrics(rec.usage)
    models = u.pop("models")
    wall = rec.result.get("wallClockMs")
    return {
        "sample": sample_id,
        "epoch": epoch,
        "outcome_correct": correct,
        "missing_facts": missing,
        "status_truthful": truthful,
        "false_pass": false_pass,
        "limit_hit": limit_hit,
        "reported_status": reported,
        "expected_status": expected_status,
        **u,
        "agents": len(dispatch_agents(rec)),
        "demand": catalog_demand(dispatch) if dispatch else None,
        "scribe": any(_is_scribe(a) for a in rec.result.get("agents") or []),
        "wall_clock_s": round(wall / 1000, 3) if isinstance(wall, (int, float)) else None,
        "queue_s": queue_seconds(rec),
        "peak_concurrency": peak_concurrency(rec),
        "models": models,
        "on_pinned_model": bool(models) and all(m.split("/")[-1] == pinned_model for m in models),
        "models_by_role": routing["by_role"],
        "misrouted": routing["misrouted"],
        "routing_ok": routing_ok,
        "hidden_check_absent": hidden_check_absent(rec.sandbox_tree, hidden_names),
        "harness_error": rec.result.get("error"),
        "by_role": cost_by_role(rec, prices),
    }


def false_passes(rows: list[dict]) -> dict:
    """False passes per sample over its scored rows (limit-hit rows are not scored), and for the whole suite."""
    by: dict[str, dict] = {}
    for r in rows:
        c = by.setdefault(r["sample"], {"false_passes": 0, "scored": 0})
        if r.get("false_pass") is None:
            continue
        c["scored"] += 1
        c["false_passes"] += bool(r["false_pass"])
    return {"by_sample": by, "total": sum(c["false_passes"] for c in by.values()), "scored": sum(c["scored"] for c in by.values())}


SPREAD_METRICS = (
    "dollars", "wall_clock_s", "queue_s", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens",
    "cache_write_share", "agents",
)


def spread(rows: list[dict]) -> dict:
    """Per sample, the run-to-run spread over its epochs: for each measured metric its min, max, spread (max - min)
    and the number of epochs with a value; outcome correctness, status truthfulness and false passes as counts over
    the scored epochs ("2/3"); and the epochs stopped at a limit. compare.py uses the same max - min as its noise band."""
    by: dict[str, list[dict]] = {}
    for r in rows:
        by.setdefault(r["sample"], []).append(r)
    out: dict[str, dict] = {}
    for sample, rs in by.items():
        scored = [r for r in rs if r.get("outcome_correct") is not None]
        d: dict = {"epochs": len(rs), "limit_hits": sum(1 for r in rs if r.get("limit_hit"))}
        for m in ("outcome_correct", "status_truthful", "false_pass"):
            d[m] = f"{sum(bool(r.get(m)) for r in scored)}/{len(scored)}"
        for m in SPREAD_METRICS:
            vs = [r[m] for r in rs if r.get(m) is not None]
            d[m] = {"min": min(vs), "max": max(vs), "spread": round(max(vs) - min(vs), 6), "n": len(vs)} if vs else None
        out[sample] = d
    return out


def run_cost(rows: list[dict], duration_s: float | None, budget: float = ROUTINE_BUDGET) -> dict:
    """What the run actually cost and how long it took, against the routine budget. Over budget, the samples to cut
    to 1 epoch before any is dropped (spec: Baseline and runs). The total is unknown (None) if any row is unpriced."""
    ds = [r.get("dollars") for r in rows]
    total = None if not ds or any(d is None for d in ds) else round(sum(ds), 6)
    over = None if total is None else total > budget
    return {"dollars": total, "duration_s": duration_s, "budget": budget, "over_budget": over, "cut_to_one_epoch": list(CUT_TO_ONE_EPOCH) if over else []}


def scorecard(header: dict, rows: list[dict], duration_s: float | None = None) -> dict:
    missing = [k for k in HEADER_FIELDS if header.get(k) in (None, "")]
    if missing:
        raise ValueError(f"scorecard header is missing: {', '.join(missing)}")
    return {
        "header": dict(header), "rows": list(rows), "false_passes": false_passes(rows), "spread": spread(rows),
        "run_cost": run_cost(rows, duration_s),
    }


def _yn(v) -> str:
    return "-" if v is None else ("yes" if v else "no")


def render_markdown(card: dict) -> str:
    h = card["header"]
    out = ["# Dispatch evals scorecard", "", "| | |", "|---|---|"]
    out += [f"| {k} | {v} |" for k, v in h.items()]
    out += [
        "",
        "| sample | epoch | correct | truthful | false pass | reported | expected | $ | in | out | cache read | cache write | cw share | agents | demand | wall s | queue s |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in card["rows"]:
        dollars = "-" if r["dollars"] is None else f"{r['dollars']:.4f}"
        wall = "-" if r["wall_clock_s"] is None else f"{r['wall_clock_s']:.1f}"
        queue = "-" if r.get("queue_s") is None else f"{r['queue_s']:.1f}"
        if r.get("limit_hit"):
            correct = truthful = false_pass = f"limit-hit ({r['limit_hit']})"
        else:
            correct, truthful, false_pass = _yn(r["outcome_correct"]), _yn(r["status_truthful"]), _yn(r.get("false_pass"))
        out.append(
            f"| {r['sample']} | {r['epoch']} | {correct} | {truthful} | {false_pass} | {r['reported_status']} | {r['expected_status']} "
            f"| {dollars} | {r['input_tokens']} | {r['output_tokens']} | {r['cache_read_tokens']} | {r['cache_write_tokens']} "
            f"| {r['cache_write_share'] * 100:.1f}% | {r['agents']} | {'-' if r.get('demand') is None else r['demand']} | {wall} | {queue} |"
        )
    fp = card.get("false_passes") or false_passes(card["rows"])
    out += ["", "False passes (done reported while the hidden check failed)", "", "| sample | false passes |", "|---|---|"]
    out += [f"| {s} | {c['false_passes']} of {c['scored']} |" for s, c in fp["by_sample"].items()]
    out.append(f"| suite total | {fp['total']} of {fp['scored']} |")
    sp = card.get("spread") or spread(card["rows"])

    def rng(v, fmt: str) -> str:
        return "-" if not v else f"{v['min']:{fmt}}-{v['max']:{fmt}} ({v['spread']:{fmt}})"

    out += [
        "", "Run-to-run spread per sample (min-max over its epochs, spread in brackets)", "",
        "| sample | epochs | correct | truthful | false pass | $ | wall s | queue s | agents |", "|---|---|---|---|---|---|---|---|---|",
    ]
    for s, d in sp.items():
        out.append(
            f"| {s} | {d['epochs']} | {d['outcome_correct']} | {d['status_truthful']} | {d['false_pass']} | {rng(d['dollars'], '.4f')} "
            f"| {rng(d['wall_clock_s'], '.1f')} | {rng(d['queue_s'], '.1f')} | {rng(d['agents'], 'g')} |"
        )
    rc = card.get("run_cost")
    if rc:
        total = "unknown (an unpriced model ran)" if rc["dollars"] is None else f"${rc['dollars']:.2f}"
        dur = "-" if rc["duration_s"] is None else f"{rc['duration_s']:.0f} s"
        out += ["", f"Run cost: {total}, duration {dur}."]
        if rc["over_budget"]:
            out.append(
                f"This run is over the ${rc['budget']:.2f} routine budget: run the routine suite with --cut-to-one-epoch "
                f"({', '.join(rc['cut_to_one_epoch'])} at 1 epoch) before dropping any sample."
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
    routed = [(r, role, m) for r in card["rows"] for role, m in (r.get("models_by_role") or {}).items()]
    if routed:
        out += ["", "Model routing (a call served by another model than requested fails the sample)", "", "| sample | epoch | role | requested | served | routed |", "|---|---|---|---|---|---|"]
        for r, role, m in routed:
            bad = any(x["role"] == role for x in r.get("misrouted") or [])
            out.append(f"| {r['sample']} | {r['epoch']} | {role} | {', '.join(m['requested'])} | {', '.join(m['served']) or '-'} | {'no' if bad else 'yes'} |")
    return "\n".join(out) + "\n"
