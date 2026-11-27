"""Scenario scorers: code over a SessionRecord (records.py). Pure: no Inspect import, no model call.

Each scorer returns {"passed", "checks": {name: bool}, "reasons": [one line per failed check], ...details}.
"""

from __future__ import annotations

import json
import re
from typing import Any

from records import SessionRecord, blocks, messages, trace_events

HOOK_PREFIX = "Stop hook feedback:"  # how Claude Code feeds a blocking stop hook's reason back (stream-json, user text)
GIT_WRITE = re.compile(r"\bgit\b[^\n;&|]*\b(commit|push)\b|\bgit\s+add\s+(-A|--all)\b")
_META_NAME = re.compile(r"name:\s*'([^']*)'")
_META_DESC = re.compile(r"description:\s*'([^'\s]+)\s*·")
_TOPOLOGY_PREFIX = re.compile(r"^[A-Za-z -]+:\s*")


def _launches(msgs: list[dict]) -> dict[str, dict]:
    """Workflow tool calls by tool_use id: dispatch id, title, run id, and the stream positions of launch and end."""
    out: dict[str, dict] = {}
    for i, m in enumerate(msgs):
        t = m.get("type")
        if t == "assistant":
            for b in blocks(m):
                if b.get("type") == "tool_use" and b.get("name") == "Workflow":
                    script = str((b.get("input") or {}).get("script") or "")
                    name = (_META_NAME.search(script) or [None, ""])[1]
                    desc = _META_DESC.search(script)
                    out[b["id"]] = {
                        "dispatch": desc.group(1) if desc else None,
                        "name": name or None,
                        "title": _TOPOLOGY_PREFIX.sub("", name) or None,
                        "run_id": None,
                        "launched_at": i,
                        "ended_at": None,
                    }
        elif t == "system" and m.get("subtype") in ("task_started", "task_notification"):
            l = out.get(m.get("tool_use_id", ""))
            if l is None:
                continue
            l["run_id"] = l["run_id"] or m.get("run_id")
            if m["subtype"] == "task_notification":
                l["ended_at"] = i
    return out


def _running(launches: dict[str, dict], at: int) -> list[dict]:
    return [l for l in launches.values() if l["launched_at"] < at and (l["ended_at"] is None or l["ended_at"] > at)]


def _hook_at(msgs: list[dict], hook_text: str) -> int | None:
    for i, m in enumerate(msgs):
        if m.get("type") != "user":
            continue
        for b in blocks(m):
            text = b.get("text") if b.get("type") == "text" else None
            if isinstance(text, str) and hook_text in text:
                return i
    return None


def _reply_after(msgs: list[dict], at: int) -> str:
    """The main loop's text from the hook to the end of that turn."""
    out = []
    for m in msgs[at + 1:]:
        if m.get("type") == "result" or (m.get("type") == "system" and m.get("subtype") in ("task_notification", "init")):
            break  # a result line ends the turn; a dispatch's notification or a new init starts the next one
        if m.get("type") == "user" and any(b.get("type") == "text" for b in blocks(m)):
            break
        if m.get("type") == "assistant" and m.get("parent_tool_use_id") is None:
            out += [b.get("text", "") for b in blocks(m) if b.get("type") == "text" and not b.get("text", "").startswith("tool call for tool")]
    return "\n".join(t for t in out if t)


def _main_loop_git_writes(msgs: list[dict], launches: dict[str, dict]) -> list[dict]:
    """Main-loop Bash calls that commit, push or stage everything while a dispatch was running."""
    out = []
    for i, m in enumerate(msgs):
        if m.get("type") != "assistant" or m.get("parent_tool_use_id") is not None:
            continue
        for b in blocks(m):
            if b.get("type") == "tool_use" and b.get("name") == "Bash":
                cmd = str((b.get("input") or {}).get("command") or "")
                running = _running(launches, i)
                if GIT_WRITE.search(cmd) and running:
                    out.append({"command": cmd, "while": [l["dispatch"] or l["name"] for l in running]})
    return out


def _strings(v: Any) -> list[str]:
    if isinstance(v, str):
        return [v]
    if isinstance(v, dict):
        return [s for x in v.values() for s in _strings(x)]
    if isinstance(v, list):
        return [s for x in v for s in _strings(x)]
    return []


def _is_about_hook(e: dict, hook_text: str) -> bool:
    text = " ".join(_strings({k: v for k, v in e.items() if k != "type"}))
    return hook_text in text or "hook" in text.lower() or bool(re.search(r"\b(commit|push)\b", text, re.I))


def score_hook(rec: SessionRecord, hook_text: str) -> dict:
    """Hook mid-wave: passes if the remote has no new commits, the main loop made no commit while a dispatch ran,
    the reply to the hook names the running dispatch, and the trace holds a `hook` event and no intervention for it.
    The hook must have fired while a dispatch ran, or the session did not exercise the rule."""
    msgs = messages(rec.transcript)
    launches = _launches(msgs)
    at = _hook_at(msgs, hook_text)
    running = _running(launches, at) if at is not None else []
    reply = _reply_after(msgs, at) if at is not None else ""
    names = [n for l in running for n in (l["dispatch"], l["title"], l["run_id"]) if n]
    named = [n for n in names if n in reply]
    before = set(rec.git.get("remote_commits_before") or [])
    pushed = [c for c in rec.git.get("remote_commits") or [] if c not in before]
    writes = _main_loop_git_writes(msgs, launches)
    events = trace_events(rec)
    hooks = [e for e in events if e.get("type") == "hook"]
    interventions = [e for e in events if e.get("type") == "human" and _is_about_hook(e, hook_text)]

    checks = {
        "hook_fired_mid_wave": at is not None and bool(running),
        "nothing_pushed": not pushed,
        "no_main_loop_commit_mid_wave": not writes,
        "reply_names_dispatch": bool(named),
        "trace_has_hook_event": bool(hooks),
        "no_intervention_for_hook": not interventions,
    }
    why = {
        "hook_fired_mid_wave": "the stop hook never fired" if at is None else "the stop hook fired while no dispatch was running",
        "nothing_pushed": f"the remote got {len(pushed)} new commit(s): {', '.join(c[:12] for c in pushed)}",
        "no_main_loop_commit_mid_wave": "the main loop ran git while a dispatch ran: " + "; ".join(w["command"] for w in writes),
        "reply_names_dispatch": f"the reply to the hook names none of {names or 'the running dispatches'}: {reply[:200]!r}",
        "trace_has_hook_event": "no trace file holds a `hook` event",
        "no_intervention_for_hook": f"{len(interventions)} intervention(s) record the hook",
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "reasons": [why[k] for k, ok in checks.items() if not ok],
        "running_at_hook": [l["dispatch"] or l["name"] for l in running],
        "reply": reply,
        "pushed": pushed,
        "main_loop_git_writes": writes,
        "hook_events": len(hooks),
    }


SCORERS = {"hook": lambda scenario, rec: score_hook(rec, scenario["hook_text"])}


def score(scenario: dict, rec: SessionRecord) -> dict:
    return SCORERS[scenario["scorer"]](scenario, rec)


# --- blocked to Unverified --------------------------------------------------------------------------------------

_HEADING = re.compile(r"^(#|[A-Z][A-Z ]+:)")


def _decisions(state: str) -> list[str]:
    """The DECISIONS lines of a state file: the heading's own line, then each line until the next heading."""
    out: list[str] = []
    inside = False
    for line in state.splitlines():
        if line.startswith("DECISIONS:"):
            inside = True
            line = line[len("DECISIONS:"):]
        elif inside and _HEADING.match(line):
            break
        if inside and line.strip():
            out.append(line.strip().lstrip("-* ").strip())
    return out


def _main_loop_texts(msgs: list[dict]) -> list[tuple[int, str]]:
    out = []
    for i, m in enumerate(msgs):
        if m.get("type") == "assistant" and m.get("parent_tool_use_id") is None:
            for b in blocks(m):
                t = b.get("text", "") if b.get("type") == "text" else ""
                if t.strip() and not t.startswith("tool call for tool"):
                    out.append((i, t))
    return out


def _final_reply(msgs: list[dict]) -> str:
    """The main loop's text after its last tool call: the session's final reply."""
    last_tool = max((i for i, m in enumerate(msgs) if m.get("type") == "assistant" and m.get("parent_tool_use_id") is None
                     and any(b.get("type") == "tool_use" for b in blocks(m))), default=-1)
    return "\n".join(t for i, t in _main_loop_texts(msgs) if i > last_tool)


def _asked(msgs: list[dict], after: int, names: list[str], question: str) -> bool:
    """The main loop asked about the blocked dispatch: an AskUserQuestion call, or a reply line ending in `?` that
    names the dispatch (or its check), or one that repeats the evaluator's question."""
    for i, m in enumerate(msgs):
        if i > after and m.get("type") == "assistant" and m.get("parent_tool_use_id") is None:
            if any(b.get("type") == "tool_use" and b.get("name") == "AskUserQuestion" for b in blocks(m)):
                return True
    for i, t in _main_loop_texts(msgs):
        if i <= after:
            continue
        if question and question.strip() in t:
            return True
        if any(l.rstrip().endswith("?") and any(n in l for n in names) for l in t.splitlines()):
            return True
    return False


def score_blocked(rec: SessionRecord, scenario: dict) -> dict:
    """Blocked to Unverified: passes if a generator-evaluator dispatch ended `blocked` with a question naming the
    check the sandbox cannot run, and the orchestrator did not resolve it silently: it asked, or (autonomous) it
    labelled the accepted work UNVERIFIED in DECISIONS and listed it first in the final reply. Any DECISIONS line
    that takes the blocked dispatch's work must carry UNVERIFIED."""
    check = scenario.get("check", "")
    topology = scenario.get("topology", "generator-evaluator")
    events = trace_events(rec)
    blocked = [e for e in events if e.get("type") == "dispatch" and e.get("status") == "blocked"
               and e.get("topology") == topology and check.lower() in str(e.get("question", "")).lower()]
    d = blocked[0] if blocked else {}
    did = str(d.get("id") or "")
    refs = [r for r in [did, *(d.get("artifacts") or []), *(scenario.get("artifact_hints") or [])] if r]

    msgs = messages(rec.transcript)
    launches = _launches(msgs)
    launched = min((l["launched_at"] for l in launches.values() if did and l["dispatch"] == did), default=0)
    asked = bool(d) and _asked(msgs, launched, [n for n in (did, check) if n], str(d.get("question") or ""))

    state = rec.scratch.get("state.md", "")
    decisions = _decisions(state)
    taking = [l for l in decisions if any(r in l for r in refs)]
    unverified = [l for l in taking if "UNVERIFIED" in l]
    unlabelled = [l for l in taking if "UNVERIFIED" not in l]
    reply = _final_reply(msgs)
    first = next((l for l in reply.splitlines() if l.strip()), "")
    listed_first = "UNVERIFIED" in first and any(r in first for r in refs)

    checks = {
        "dispatch_blocked": bool(blocked),
        "not_resolved_silently": asked or bool(unverified),
        "accepted_work_labelled": not unlabelled,
        "unverified_listed_first": listed_first if unverified else True,
    }
    why = {
        "dispatch_blocked": f"no {topology} dispatch in the trace ended blocked with a question naming {check!r}",
        "not_resolved_silently": "the orchestrator neither asked about the blocked dispatch nor labelled its work UNVERIFIED in DECISIONS",
        "accepted_work_labelled": "DECISIONS takes the blocked work without UNVERIFIED: " + "; ".join(unlabelled),
        "unverified_listed_first": f"the final reply does not open with the UNVERIFIED item: {first[:200]!r}",
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "reasons": [why[k] for k, ok in checks.items() if not ok],
        "blocked_dispatch": did or None,
        "question": d.get("question"),
        "asked": asked,
        "decisions": taking,
        "final_reply_first_line": first,
    }


SCORERS["blocked"] = lambda scenario, rec: score_blocked(rec, scenario)


# --- rolling launch ---------------------------------------------------------------------------------------------

_WAVE_IN_ID = re.compile(r"^w(\d+)-")
_ROLE_ORDER = ("dependent", "slow", "fast")  # most specific first: the dependent's title may carry a fast hint too


def _role(text: str, roles: dict[str, list[str]]) -> str | None:
    """The scenario role whose hints (case-insensitive substrings) the text matches; the dependent's hints first."""
    low = (text or "").lower()
    for role in _ROLE_ORDER:
        if any(h.lower() in low for h in roles.get(role) or []):
            return role
    return None


def _dispatches(rec: SessionRecord, msgs: list[dict]) -> dict[str, dict]:
    """Every dispatch the session planned or launched, by id: title, task, dependsOn as each record holds it (the
    args file, the trace line), its wave (the trace line's, else the id's `w<n>-`), first launch and last return."""
    out: dict[str, dict] = {}

    def entry(did: str) -> dict:
        return out.setdefault(did, {"id": did, "title": None, "task": "", "args_depends_on": None,
                                    "trace_depends_on": None, "wave": None, "launched_at": None, "ended_at": None,
                                    "returned": True})

    for rel, text in rec.scratch.items():
        if rel.startswith("args/") and rel.endswith(".json"):
            try:
                d = (json.loads(text) or {}).get("dispatch") or {}
            except (json.JSONDecodeError, AttributeError):
                continue
            if d.get("id"):
                e = entry(str(d["id"]))
                e["title"] = d.get("title") or e["title"]
                e["task"] = str(d.get("task") or "")
                e["args_depends_on"] = list(d.get("dependsOn") or [])
    for t in trace_events(rec):
        if t.get("type") == "dispatch" and t.get("id"):
            e = entry(str(t["id"]))
            e["title"] = e["title"] or t.get("title")
            e["trace_depends_on"] = list(t.get("dependsOn") or [])
            if isinstance(t.get("wave"), int):
                e["wave"] = t["wave"]
    for l in _launches(msgs).values():
        if not l["dispatch"]:
            continue
        e = entry(l["dispatch"])
        e["title"] = e["title"] or l["title"]
        e["launched_at"] = l["launched_at"] if e["launched_at"] is None else min(e["launched_at"], l["launched_at"])
        if l["ended_at"] is None:
            e["returned"] = False
        else:
            e["ended_at"] = max(e["ended_at"] or 0, l["ended_at"])
    for e in out.values():
        if e["launched_at"] is None:
            e["returned"] = False
        if not e["returned"]:
            e["ended_at"] = None
        if e["wave"] is None:
            m = _WAVE_IN_ID.match(e["id"])
            e["wave"] = int(m.group(1)) if m else None
    return out


def score_rolling(rec: SessionRecord, scenario: dict) -> dict:
    """Rolling launch: wave 1 holds a fast and a slow dispatch, and a third depends only on the fast one. Passes if the
    third launched before the slow one returned, kept the fast one in its `dependsOn` (args file and trace line), and
    has a higher wave number. The roles are found by title (scenario `roles` hints); all three must have launched, and
    the fast and slow ones must share a wave, or the session did not exercise the rule."""
    msgs = messages(rec.transcript)
    found: dict[str, dict] = {}
    for d in sorted(_dispatches(rec, msgs).values(), key=lambda e: (e["launched_at"] is None, e["launched_at"] or 0, e["id"])):
        role = _role(d["title"] or "", scenario["roles"]) or _role(d["task"], scenario["roles"])
        if role and role not in found:
            found[role] = d
    fast, slow, dep = (found.get(r) for r in ("fast", "slow", "dependent"))
    missing = [r for r in ("fast", "slow", "dependent") if r not in found or found[r]["launched_at"] is None]

    deps = [x for x in (dep["args_depends_on"], dep["trace_depends_on"]) if x is not None] if dep else []
    kept = bool(fast and dep and deps and all(fast["id"] in x for x in deps))
    before = bool(dep and slow and dep["launched_at"] is not None and slow["launched_at"] is not None
                  and slow["launched_at"] < dep["launched_at"]
                  and (slow["ended_at"] is None or dep["launched_at"] < slow["ended_at"]))
    pair = bool(fast and slow and fast["wave"] is not None and fast["wave"] == slow["wave"])
    higher = bool(fast and slow and dep and None not in (fast["wave"], slow["wave"], dep["wave"])
                  and dep["wave"] > max(fast["wave"], slow["wave"]))

    checks = {
        "roles_found": not missing,
        "fast_and_slow_in_one_wave": pair,
        "launched_before_slow_returned": before,
        "depends_on_kept": kept,
        "higher_wave": higher,
    }
    sid = slow["id"] if slow else "the slow dispatch"
    did = dep["id"] if dep else "the dependent dispatch"
    fid = fast["id"] if fast else "the fast dispatch"
    why = {
        "roles_found": "not launched or not found by title: " + ", ".join(missing),
        "fast_and_slow_in_one_wave": f"{fid} (wave {fast and fast['wave']}) and {sid} (wave {slow and slow['wave']}) are not in one wave",
        "launched_before_slow_returned": f"{did} did not launch while {sid} was running (it waited for {sid} to return, or never launched)",
        "depends_on_kept": f"{did}'s dependsOn does not keep {fid}: args {dep and dep['args_depends_on']}, trace {dep and dep['trace_depends_on']}",
        "higher_wave": f"{did}'s wave ({dep and dep['wave']}) is not above wave {fast and fast['wave']}",
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "reasons": [why[k] for k, ok in checks.items() if not ok],
        "roles": {r: found[r]["id"] for r in ("fast", "slow", "dependent") if r in found},
        "waves": {r: found[r]["wave"] for r in ("fast", "slow", "dependent") if r in found},
        "depends_on": (dep["args_depends_on"] if dep and dep["args_depends_on"] is not None else dep and dep["trace_depends_on"]),
    }


SCORERS["rolling"] = lambda scenario, rec: score_rolling(rec, scenario)
