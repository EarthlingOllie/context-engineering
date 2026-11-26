"""Run parameters (ticket 04): defaults, command-line overrides, the sandbox's
hardware, the header that records them, and limit-hit samples in the scorecard.
No model call. The Task test needs Inspect installed and is skipped without it.
"""

from __future__ import annotations

import importlib.util
import unittest
from types import SimpleNamespace

import run
import suite

HAS_INSPECT = importlib.util.find_spec("inspect_ai") is not None


class Defaults(unittest.TestCase):
    def test_the_spec_defaults(self):
        a = run.build_parser().parse_args([])
        self.assertEqual(
            (a.epochs, a.cost_limit, a.time_limit, a.cap, a.cpus, a.memory),
            (3, 30.0, 1800, 2, 4, "8g"),
        )

    def test_each_can_be_overridden_from_the_command_line(self):
        a = run.build_parser().parse_args(
            ["--epochs", "1", "--cost-limit", "5", "--time-limit", "600", "--cap", "4", "--cpus", "8", "--memory", "16g"]
        )
        self.assertEqual(
            (a.epochs, a.cost_limit, a.time_limit, a.cap, a.cpus, a.memory),
            (1, 5.0, 600, 4, 8, "16g"),
        )


class SandboxHardware(unittest.TestCase):
    def test_cpu_count_and_memory_are_applied_to_the_sandbox(self):
        y = suite.compose_yaml(cpus=6, memory="12g")
        self.assertIn("    cpus: 6\n", y)
        self.assertIn("    mem_limit: 12g\n", y)


def fake_log(task_args: dict, samples: list) -> SimpleNamespace:
    return SimpleNamespace(
        eval=SimpleNamespace(
            task_args=task_args,
            model="anthropic/claude-opus-5-5",
            packages={"inspect_ai": "0.3.292"},
            config=SimpleNamespace(epochs=1),
            created="2026-11-26T00:00:00Z",
        ),
        samples=samples,
        location="logs/x.eval",
    )


def fake_sample(limit=None, result=None) -> SimpleNamespace:
    return SimpleNamespace(
        id="01-single-docs",
        epoch=1,
        store={"harness_result": result or {}, "sandbox_tree": ["/work/docs/glossary.md"]},
        model_usage={},
        metadata={"fixture": "docs", "expected_status": "done"},
        limit=limit,
    )


class Header(unittest.TestCase):
    def test_cpu_count_memory_and_limits_are_recorded_in_the_header(self):
        card = run.build_scorecard(
            fake_log({"cap": 3, "cpus": 6, "memory": "12g", "cost_limit": 5.0, "time_limit": 600}, [fake_sample()]), "abc123"
        )
        h = card["header"]
        self.assertEqual((h["concurrency_cap"], h["cpus"], h["memory"], h["cost_limit"], h["time_limit"]), (3, 6, "12g", 5.0, 600))


class LimitHit(unittest.TestCase):
    def test_a_sample_stopped_by_a_limit_is_reported_as_limit_hit_not_as_a_failure(self):
        for kind in ("cost", "time"):
            limit = SimpleNamespace(type=kind, limit=30.0, reason=f"{kind} limit exceeded")
            (r,) = run.build_scorecard(fake_log({}, [fake_sample(limit=limit)]), "abc123")["rows"]
            self.assertEqual(r["limit_hit"], kind)
            self.assertIsNone(r["outcome_correct"])
            self.assertIsNone(r["status_truthful"])

    def test_a_sample_within_its_limits_is_scored(self):
        (r,) = run.build_scorecard(fake_log({}, [fake_sample()]), "abc123")["rows"]
        self.assertIsNone(r["limit_hit"])
        self.assertIs(r["status_truthful"], False)


@unittest.skipUnless(HAS_INSPECT, "inspect_ai not installed")
class EverySampleIsLimited(unittest.TestCase):
    def test_every_sample_has_a_wall_clock_and_a_cost_limit(self):
        from dispatch_suite import dispatch_suite

        for stub in (False, True):
            t = dispatch_suite(stub=stub, cost_limit=7.5, time_limit=900)
            self.assertEqual((t.cost_limit, t.time_limit), (7.5, 900), f"stub={stub}")

    def test_the_task_runs_with_the_spec_defaults(self):
        from dispatch_suite import dispatch_suite

        t = dispatch_suite()
        self.assertEqual((t.cost_limit, t.time_limit, t.epochs), (30.0, 1800, 3))


if __name__ == "__main__":
    unittest.main()
