"""Ticket-01 condition 6, tested first: does Inspect's Anthropic provider send
ANTHROPIC_API_KEY plus the workspace key?

How the workspace key must be sent is not known (spec). This probe makes the
mechanism explicit and checks the wire, with two candidate routes:
  env:     ANTHROPIC_CUSTOM_HEADERS="<header>: <value>" (read by the anthropic
           SDK, which Inspect's provider uses, and by Claude Code itself)
  margs:   -M default_headers='{"<header>": "<value>"}' (Inspect passes unknown
           model args through to the AsyncAnthropic constructor)

  python auth_probe.py --dry-run [--header anthropic-workspace-id]
      Free. Fake key values, a mock HTTP transport, no network. Shows which
      headers reach the wire for each route.
  python auth_probe.py --live [--header ...] [--route env|margs]
      PAID (one tiny claude-haiku-5-5 call, well under $0.01). Uses the real
      ANTHROPIC_API_KEY and ANTHROPIC_WORKSPACE_KEY from the environment and
      prints only presence, status and response model, never a value.

The Agent SDK inside the sandbox does not need either key: it talks to the
bridge on localhost, and the bridge forwards through this same provider.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os

import httpx2 as httpx  # the anthropic SDK 2.x uses httpx2

from inspect_ai.model import ChatMessageUser, GenerateConfig, get_model

FAKE_KEY = "sk-ant-api-FAKE"
FAKE_WS = "ws-FAKE"


def _mock_client(seen: list[dict]) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append({k.lower(): v for k, v in request.headers.items()})
        body = {
            "id": "msg_mock", "type": "message", "role": "assistant", "model": "claude-haiku-5-5",
            "content": [{"type": "text", "text": "ok"}], "stop_reason": "end_turn", "stop_sequence": None,
            "usage": {"input_tokens": 1, "output_tokens": 1, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0},
        }
        return httpx.Response(200, json=body)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def _call(route: str, header: str, api_key: str, ws: str, http_client: httpx.AsyncClient | None) -> object:
    env_backup = {k: os.environ.get(k) for k in ("ANTHROPIC_CUSTOM_HEADERS", "ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY")}
    try:
        # A session-level ANTHROPIC_BASE_URL (e.g. a cloud session's proxy) must not redirect the probe.
        os.environ.pop("ANTHROPIC_BASE_URL", None)
        os.environ["ANTHROPIC_API_KEY"] = api_key
        margs: dict = {}
        if http_client is not None:
            margs["http_client"] = http_client
        if route == "env":
            os.environ["ANTHROPIC_CUSTOM_HEADERS"] = f"{header}: {ws}"
        else:
            os.environ.pop("ANTHROPIC_CUSTOM_HEADERS", None)
            margs["default_headers"] = {header: ws}
        model = get_model("anthropic/claude-haiku-5-5", config=GenerateConfig(max_tokens=16), memoize=False, **margs)
        out = await model.generate([ChatMessageUser(content="Reply with the single word: ok")])
        return out
    finally:
        for k, v in env_backup.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


async def dry_run(header: str) -> dict:
    report = {}
    for route in ("env", "margs"):
        seen: list[dict] = []
        try:
            await _call(route, header, FAKE_KEY, FAKE_WS, _mock_client(seen))
            h = seen[-1] if seen else {}
            report[route] = {
                "requests": len(seen),
                "x-api-key sent": h.get("x-api-key") == FAKE_KEY,
                f"{header} sent": h.get(header.lower()) == FAKE_WS,
                "authorization carries the api key": h.get("authorization") == f"Bearer {FAKE_KEY}",
                "authorization scheme": (h.get("authorization") or " ").split(" ")[0] or None,
            }
        except Exception as e:  # noqa: BLE001
            report[route] = {"error": f"{type(e).__name__}: {e}"[:300]}
    return report


async def live(header: str, route: str) -> dict:
    key, ws = os.environ.get("ANTHROPIC_API_KEY"), os.environ.get("ANTHROPIC_WORKSPACE_KEY")
    rep: dict = {"ANTHROPIC_API_KEY present": bool(key), "ANTHROPIC_WORKSPACE_KEY present": bool(ws), "route": route, "header": header}
    if not key or not ws:
        rep["result"] = "not run: a key is missing"
        return rep
    try:
        out = await _call(route, header, key, ws, None)
        rep["result"] = "ok"
        rep["served_model"] = getattr(out, "model", None)
        rep["usage"] = out.usage.model_dump() if getattr(out, "usage", None) else None
    except Exception as e:  # noqa: BLE001
        rep["result"] = f"{type(e).__name__}: {str(e)[:300]}"
    return rep


def main() -> None:
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--live", action="store_true")
    p.add_argument("--header", default="anthropic-workspace-id", help="HTTP header that carries the workspace key (to be confirmed)")
    p.add_argument("--route", choices=["env", "margs"], default="env")
    a = p.parse_args()
    rep = asyncio.run(dry_run(a.header) if a.dry_run else live(a.header, a.route))
    print(json.dumps(rep, indent=2, default=str))


if __name__ == "__main__":
    main()
