"""The GitHub Actions entry point: the workflow's inputs, as INPUT_<NAME> environment variables, become run.py's options.

    INPUT_STUB=true INPUT_EPOCHS=1 python graph-orchestrator/evals/ci.py

Inputs: STUB (true|false), EPOCHS (a positive whole number, empty for the default), SAMPLES (comma-separated sample
ids), ROLE_MODELS (comma-separated ROLE=MODEL), BASELINE (always refused: freezing the baseline is a deliberate local
step). Each value is checked before it reaches run.py, so no input can carry another option. A paid run needs
ANTHROPIC_API_KEY (the repository secret); a stub run needs nothing. The key is never printed.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Callable, Mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))

_NAME = r"[A-Za-z0-9][A-Za-z0-9._-]*"


class Refused(Exception):
    """An input the job will not run with."""


def _flag(env: Mapping[str, str], name: str) -> bool:
    v = env.get(f"INPUT_{name}", "").strip().lower()
    if v in ("", "false"):
        return False
    if v == "true":
        return True
    raise Refused(f"{name.lower()} must be true or false, not {v!r}")


def argv_from_inputs(env: Mapping[str, str]) -> list[str]:
    """run.py's argument list for the workflow inputs in env, or Refused with why."""
    if _flag(env, "BASELINE"):
        raise Refused("the job never freezes the baseline: run `run.py --baseline` locally on a clean commit and commit its files")
    argv: list[str] = []
    if _flag(env, "STUB"):
        argv.append("--stub")
    epochs = env.get("INPUT_EPOCHS", "").strip()
    if epochs:
        if not re.fullmatch(r"[1-9][0-9]{0,2}", epochs):
            raise Refused(f"epochs must be a whole number from 1, not {epochs!r}")
        argv += ["--epochs", epochs]
    samples = env.get("INPUT_SAMPLES", "").strip()
    if samples:
        if not re.fullmatch(rf"{_NAME}(,{_NAME})*", samples):
            raise Refused(f"samples must be comma-separated sample ids, not {samples!r}")
        argv += ["--samples", samples]
    for pair in (p.strip() for p in env.get("INPUT_ROLE_MODELS", "").split(",")):
        if not pair:
            continue
        if not re.fullmatch(rf"{_NAME}={_NAME}", pair):
            raise Refused(f"role_models must be comma-separated ROLE=MODEL, not {pair!r}")
        argv += ["--role-model", pair]
    return argv


def main(env: Mapping[str, str] | None = None, run_main: Callable[[list[str]], int] | None = None) -> int:
    env = os.environ if env is None else env
    try:
        argv = argv_from_inputs(env)
    except Refused as e:
        print(f"refused: {e}", file=sys.stderr)
        return 2
    if "--stub" not in argv and not env.get("ANTHROPIC_API_KEY"):
        print("refused: a paid run needs the ANTHROPIC_API_KEY repository secret (or set stub)", file=sys.stderr)
        return 2
    print(f"run.py {' '.join(argv)}".rstrip(), file=sys.stderr)
    if run_main is None:
        import run

        run_main = run.main
    return run_main(argv)


if __name__ == "__main__":
    sys.exit(main())
