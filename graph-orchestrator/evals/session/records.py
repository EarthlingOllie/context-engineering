"""A session's records: what the harness collects and every scorer reads.

Pure: no Inspect import. A saved record is a directory:

    transcript.jsonl   Claude Code's stream-json (inspect_swe debug stdout), one JSON object per line
    git.json           remote_commits_before, remote_commits (bare remote, every ref), local_commits
                       (commits on top of the fixture: sha, committed_at, subject), status (porcelain)
    scratch/           the session's scratch directory as collected (state.md, args/, trace/, session.mmd);
                       the copied plugin workflows are left out
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable


@dataclass
class SessionRecord:
    transcript: list[str]
    scratch: dict[str, str] = field(default_factory=dict)  # path under the scratch directory -> text
    git: dict[str, Any] = field(default_factory=dict)


def load_record(d: Path) -> SessionRecord:
    d = Path(d)
    sd = d / "scratch"
    scratch = {str(p.relative_to(sd)): p.read_text() for p in sorted(sd.rglob("*")) if p.is_file()} if sd.is_dir() else {}
    return SessionRecord(
        transcript=(d / "transcript.jsonl").read_text().splitlines(),
        scratch=scratch,
        git=json.loads((d / "git.json").read_text()) if (d / "git.json").exists() else {},
    )


def save_record(rec: SessionRecord, d: Path) -> None:
    d = Path(d)
    d.mkdir(parents=True, exist_ok=True)
    (d / "transcript.jsonl").write_text("\n".join(rec.transcript) + "\n")
    (d / "git.json").write_text(json.dumps(rec.git, indent=2) + "\n")
    for rel, text in rec.scratch.items():
        p = d / "scratch" / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)


def record_from_store(st: dict) -> SessionRecord:
    """The record an Inspect sample's store holds (task.py writes transcript, scratch, git)."""
    return SessionRecord(
        transcript=(st.get("transcript") or "").splitlines(),
        scratch=st.get("scratch") or {},
        git=st.get("git") or {},
    )


# --- reading the transcript -----------------------------------------------------------------------------------


def messages(lines: Iterable[str]) -> list[dict[str, Any]]:
    out = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            m = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(m, dict):
            out.append(m)
    return out


def blocks(m: dict[str, Any]) -> list[dict[str, Any]]:
    content = (m.get("message") or {}).get("content")
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    return content if isinstance(content, list) else []


def trace_events(rec: SessionRecord) -> list[dict[str, Any]]:
    """Every JSON line of every trace file (trace/*.jsonl) in the scratch directory."""
    out = []
    for rel in sorted(rec.scratch):
        if rel.startswith("trace/") and rel.endswith(".jsonl"):
            out += messages(rec.scratch[rel].splitlines())
    return out


def session_facts(rec: SessionRecord) -> dict[str, Any]:
    """Claude Code version, cost and tokens of the session, from its transcript. Claude Code prints one result line
    per turn: total_cost_usd and modelUsage are cumulative, duration_ms and num_turns per turn."""
    msgs = messages(rec.transcript)
    init = next((m for m in msgs if m.get("type") == "system" and m.get("subtype") == "init"), {})
    results = [m for m in msgs if m.get("type") == "result"]
    last = results[-1] if results else {}
    usage = list((last.get("modelUsage") or {}).values())
    return {
        "claude_code_version": init.get("claude_code_version"),
        "turns": len(results),
        "dollars": last.get("total_cost_usd"),
        "duration_s": round(sum(r.get("duration_ms") or 0 for r in results) / 1000, 3) if results else None,
        "input_tokens": sum(u.get("inputTokens", 0) for u in usage) if usage else None,
        "output_tokens": sum(u.get("outputTokens", 0) for u in usage) if usage else None,
        "cache_read_tokens": sum(u.get("cacheReadInputTokens", 0) for u in usage) if usage else None,
        "cache_write_tokens": sum(u.get("cacheCreationInputTokens", 0) for u in usage) if usage else None,
    }
