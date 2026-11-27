"""Session-sandbox spike probe: reads the stream-json transcript of one headless
Claude Code session (inspect_swe debug stdout, one JSON object per line) and
says what the spike needs to know. Pure: no Inspect import, no model call.
"""

from __future__ import annotations

import json
from typing import Any, Iterable

SKILL = "graph-orchestrator:graph-orchestrator"


def _messages(lines: Iterable[str]) -> list[dict[str, Any]]:
    out = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def _blocks(m: dict[str, Any]) -> list[dict[str, Any]]:
    content = (m.get("message") or {}).get("content")
    return content if isinstance(content, list) else []


def analyse(lines: Iterable[str]) -> dict[str, Any]:
    msgs = _messages(lines)
    skill_calls = {
        b["id"]
        for m in msgs if m.get("type") == "assistant"
        for b in _blocks(m)
        if b.get("type") == "tool_use" and b.get("name") == "Skill" and (b.get("input") or {}).get("skill") == SKILL
    }
    skill_text = any(
        b.get("type") == "text" and b.get("text", "").startswith("Base directory for this skill:")
        and "/skills/graph-orchestrator" in b.get("text", "").splitlines()[0]
        for m in msgs if m.get("type") == "user"
        for b in _blocks(m)
    )
    launches = _workflow_launches(msgs)
    init = next((m for m in msgs if m.get("type") == "system" and m.get("subtype") == "init"), {})
    plugin = next((p for p in init.get("plugins") or [] if p.get("name") == "graph-orchestrator"), None)
    return {
        "claude_code_version": init.get("claude_code_version"),
        "plugin_loaded": plugin is not None,
        "plugin_path": (plugin or {}).get("path"),
        "workflow_tool_available": "Workflow" in (init.get("tools") or []),
        "skill_loaded": bool(skill_calls) and skill_text,
        "workflow_launches": launches,
        "workflow_returned": any(l["status"] == "completed" for l in launches),
        **_cost(msgs),
    }


def _cost(msgs: list[dict[str, Any]]) -> dict[str, Any]:
    """Claude Code prints one result line per turn; total_cost_usd and modelUsage
    are cumulative for the session, duration_ms and num_turns are per turn."""
    results = [m for m in msgs if m.get("type") == "result"]
    if not results:
        return {"results": 0, "cost_usd": None, "duration_ms": None, "num_turns": None, "tokens": None}
    last = results[-1]
    usage = (last.get("modelUsage") or {}).values()
    return {
        "results": len(results),
        "cost_usd": last.get("total_cost_usd"),
        "duration_ms": sum(r.get("duration_ms") or 0 for r in results),
        "num_turns": sum(r.get("num_turns") or 0 for r in results),
        "tokens": {
            "input": sum(u.get("inputTokens", 0) for u in usage),
            "output": sum(u.get("outputTokens", 0) for u in usage),
            "cache_read": sum(u.get("cacheReadInputTokens", 0) for u in usage),
            "cache_write": sum(u.get("cacheCreationInputTokens", 0) for u in usage),
        },
    }


def _workflow_launches(msgs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One entry per Workflow tool call: launch result, run id, name, notified status."""
    launches: dict[str, dict[str, Any]] = {}
    for m in msgs:
        t = m.get("type")
        if t == "assistant":
            for b in _blocks(m):
                if b.get("type") == "tool_use" and b.get("name") == "Workflow":
                    launches[b["id"]] = {
                        "tool_use_id": b["id"], "run_id": None, "name": None,
                        "status": "no_launch_result", "summary": None, "notified_turn": False,
                    }
        elif t == "user":
            for b in _blocks(m):
                l = launches.get(b.get("tool_use_id", "")) if b.get("type") == "tool_result" else None
                if l is None:
                    continue
                text = b.get("content") if isinstance(b.get("content"), str) else json.dumps(b.get("content"))
                if b.get("is_error"):
                    l["status"], l["summary"] = "launch_error", text[:300]
                else:
                    l["status"] = "launched"
                    for line in text.splitlines():
                        if line.startswith("Run ID: "):
                            l["run_id"] = line[len("Run ID: "):].strip()
        elif t == "system" and m.get("subtype") in ("task_started", "task_notification"):
            l = launches.get(m.get("tool_use_id", ""))
            if l is None:
                continue
            if m["subtype"] == "task_started":
                l["name"] = m.get("workflow_name")
            else:
                l["status"], l["summary"] = m.get("status"), m.get("summary")
        elif t == "result" and (m.get("origin") or {}).get("kind") == "task-notification":
            for l in launches.values():
                if l["status"] in ("completed", "failed"):
                    l["notified_turn"] = True
    return list(launches.values())


BUDGET_USD = 75.0  # spec: a full session-eval run fits $75
SCENARIOS = 3  # hook mid-wave, blocked to Unverified, rolling launch


def recommend(findings: dict[str, Any], live: bool, budget: float = BUDGET_USD, scenarios: int = SCENARIOS) -> dict[str, Any]:
    """build-08, stop, or pending-live-run (a mock run proves plumbing, not cost)."""
    if not findings.get("skill_loaded"):
        return {"decision": "stop", "max_epochs": None,
                "reason": "the orchestrator skill did not load in the sandbox"}
    if not findings.get("workflow_returned"):
        return {"decision": "stop", "max_epochs": None,
                "reason": "no Workflow launch returned a completed result in the sandbox"}
    if not live:
        return {"decision": "pending-live-run", "max_epochs": None,
                "reason": "skill load and Workflow launch work; cost and wall clock need the paid live run"}
    cost = findings.get("cost_usd")
    if not cost:
        return {"decision": "stop", "max_epochs": None, "reason": "the live run reported no cost"}
    epochs = int(budget // (cost * scenarios))
    if epochs < 1:
        return {"decision": "stop", "max_epochs": 0,
                "reason": f"one epoch of {scenarios} scenarios at ${cost:.2f} a session exceeds ${budget:.0f}"}
    return {"decision": "build-08", "max_epochs": epochs,
            "reason": f"${cost:.2f} a session: {epochs} epochs of {scenarios} scenarios fit ${budget:.0f}"}
