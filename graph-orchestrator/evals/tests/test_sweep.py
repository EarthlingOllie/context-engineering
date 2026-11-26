"""The concurrency sweep (ticket 12): an on-demand command, outside the routine run
and its budget, that runs the two fan-out samples (6 and 7) at several caps and
reports one table of cap, wall clock, queue time and dollars per sample.
No model call. The Task tests need Inspect installed and are skipped without it.
"""

from __future__ import annotations

import importlib.util
import unittest
from types import SimpleNamespace

import run
import suite
import sweep

HAS_INSPECT = importlib.util.find_spec("inspect_ai") is not None


class Parameters(unittest.TestCase):
    def test_caps_cpus_and_memory_default_to_caps_2_4_8_on_4_cpus(self):
        a = sweep.build_parser().parse_args([])
        self.assertEqual((sweep.parse_caps(a.caps), a.cpus, a.memory), ([2, 4, 8], 4, "8g"))

    def test_caps_cpus_and_memory_can_be_overridden(self):
        a = sweep.build_parser().parse_args(["--caps", "1,3", "--cpus", "8", "--memory", "16g"])
        self.assertEqual((sweep.parse_caps(a.caps), a.cpus, a.memory), ([1, 3], 8, "16g"))

    def test_the_sweep_has_its_own_epochs_and_limits_not_the_routine_run_budget(self):
        a = sweep.build_parser().parse_args([])
        self.assertEqual((a.epochs, a.cost_limit, a.time_limit, a.stub), (1, 30.0, 1800, False))
        a = sweep.build_parser().parse_args(["--epochs", "3", "--cost-limit", "5", "--time-limit", "600", "--stub", "--stub-delay-ms", "300"])
        self.assertEqual((a.epochs, a.cost_limit, a.time_limit, a.stub, a.stub_delay_ms), (3, 5.0, 600, True, 300))

    def test_a_cap_must_be_a_positive_integer(self):
        for bad in ("", "0,2", "2,-4"):
            with self.assertRaises(ValueError):
                sweep.parse_caps(bad)


class Output(unittest.TestCase):
    def test_the_sweep_writes_its_json_and_markdown_under_the_out_dir(self):
        import json
        import tempfile
        from pathlib import Path

        result = sweep.build_sweep(fake_log([fake_sample(S6, 2, 1, 10000, [0], 0.5)]), "abc123")
        with tempfile.TemporaryDirectory() as d:
            j, m = sweep.write_sweep(result, Path(d))
            self.assertTrue(j.name.startswith("abc123-") and j.suffix == ".json" and m.suffix == ".md")
            self.assertEqual(json.loads(j.read_text())["table"][0]["cap"], 2)
            self.assertIn("# Concurrency sweep", m.read_text())


class Samples(unittest.TestCase):
    def test_the_sweep_runs_samples_6_and_7_once_per_cap(self):
        got = [(s["id"], s["cap"], s["sample"]) for s in suite.sweep_samples([2, 4, 8])]
        self.assertEqual(
            got,
            [
                ("06-fan-out-reducer-docs@cap2", 2, "06-fan-out-reducer-docs"),
                ("06-fan-out-reducer-docs@cap4", 4, "06-fan-out-reducer-docs"),
                ("06-fan-out-reducer-docs@cap8", 8, "06-fan-out-reducer-docs"),
                ("07-fan-out-partition-docs@cap2", 2, "07-fan-out-partition-docs"),
                ("07-fan-out-partition-docs@cap4", 4, "07-fan-out-partition-docs"),
                ("07-fan-out-partition-docs@cap8", 8, "07-fan-out-partition-docs"),
            ],
        )

    def test_each_sweep_sample_keeps_its_dispatch_spec_and_hidden_check(self):
        by_id = {s["id"]: s for s in suite.load_samples()}
        for s in suite.sweep_samples([4]):
            src = by_id[s["sample"]]
            self.assertEqual((s["args"], s["fixture"], s["expected_status"], s.get("check")), (src["args"], src["fixture"], src["expected_status"], src.get("check")))

    def test_the_routine_run_has_no_sweep_samples(self):
        self.assertFalse([s for s in suite.load_samples() if "@cap" in s["id"] or "cap" in s])
        self.assertFalse(hasattr(run.build_parser().parse_args([]), "caps"))


def fake_sample(sample: str, cap: int, epoch: int, wall_ms: int, queued_ms: list[int], cost: float) -> SimpleNamespace:
    agents = [{"n": i + 1, "label": f"Worker ({i + 1} of {len(queued_ms)}): part", "queuedMs": q} for i, q in enumerate(queued_ms)]
    src = next(s for s in suite.load_samples() if s["id"] == sample)
    return SimpleNamespace(
        id=f"{sample}@cap{cap}",
        epoch=epoch,
        store={"harness_result": {"wallClockMs": wall_ms, "cap": cap, "return": {"status": "done", "result": ""}, "agents": agents}},
        model_usage={"anthropic/claude-opus-5-5": SimpleNamespace(model_dump=lambda c=cost: {"input_tokens": 1, "output_tokens": 1, "total_cost": c})},
        metadata={"fixture": src["fixture"], "expected_status": "done", "check": src.get("check", {}), "args": src["args"], "sample": sample, "cap": cap},
        limit=None,
    )


def fake_log(samples: list, **task_args) -> SimpleNamespace:
    return SimpleNamespace(
        eval=SimpleNamespace(
            task_args={"caps": "2,4,8", "cpus": 4, "memory": "8g", **task_args},
            model="anthropic/claude-opus-5-5",
            packages={"inspect_ai": "0.3.292"},
            config=SimpleNamespace(epochs=2),
            created="2026-11-26T00:00:00Z",
        ),
        samples=samples,
        location="logs/sweep.eval",
    )


S6, S7 = "06-fan-out-reducer-docs", "07-fan-out-partition-docs"


class Table(unittest.TestCase):
    def setUp(self):
        self.result = sweep.build_sweep(
            fake_log(
                [
                    fake_sample(S7, 8, 1, 4000, [0, 0], 2.0),
                    fake_sample(S6, 8, 1, 9000, [0], 0.25),
                    fake_sample(S6, 2, 1, 10000, [2000, 1000], 0.5),
                    fake_sample(S6, 2, 2, 20000, [0], 1.5),
                    fake_sample(S6, 4, 1, 12000, [500], 0.75),
                ]
            ),
            "abc123",
        )

    def test_one_row_per_sample_and_cap_with_wall_clock_queue_time_and_dollars_averaged_over_epochs(self):
        got = [(r["sample"], r["cap"], r["epochs"], r["wall_clock_s"], r["queue_s"], r["dollars"]) for r in self.result["table"]]
        self.assertEqual(
            got,
            [
                (S6, 2, 2, 15.0, 1.5, 1.0),
                (S6, 4, 1, 12.0, 0.5, 0.75),
                (S6, 8, 1, 9.0, 0.0, 0.25),
                (S7, 8, 1, 4.0, 0.0, 2.0),
            ],
        )

    def test_the_cost_of_the_pass_is_the_sum_over_every_run(self):
        self.assertEqual(self.result["total_dollars"], 5.0)

    def test_the_header_records_the_caps_cpus_and_memory(self):
        h = self.result["header"]
        self.assertEqual((h["caps"], h["cpus"], h["memory"], h["plugin_commit"]), ([2, 4, 8], 4, "8g", "abc123"))
        self.assertNotIn("concurrency_cap", h)

    def test_the_markdown_is_one_table_of_cap_wall_clock_queue_time_and_dollars_per_sample(self):
        md = sweep.render_sweep_markdown(self.result)
        self.assertIn("| sample | cap | wall clock s | queue s | $ | epochs |", md)
        self.assertIn(f"| {S6} | 2 | 15.0 | 1.5 | 1.0000 | 2 |", md)
        self.assertIn(f"| {S7} | 8 | 4.0 | 0.0 | 2.0000 | 1 |", md)
        self.assertEqual(md.count("| sample | cap |"), 1)
        self.assertIn("| total | | | | 5.0000 | |", md)

    def test_unpriced_or_missing_values_show_as_a_dash(self):
        s = fake_sample(S6, 2, 1, 10000, [0], 0.0)
        s.model_usage = {"anthropic/claude-opus-5-5": SimpleNamespace(model_dump=lambda: {"input_tokens": 1, "total_cost": None})}
        s.store["harness_result"].pop("wallClockMs")
        r = sweep.build_sweep(fake_log([s]), "abc123")
        self.assertEqual((r["table"][0]["dollars"], r["table"][0]["wall_clock_s"], r["total_dollars"]), (None, None, None))
        self.assertIn(f"| {S6} | 2 | - | 0.0 | - | 1 |", sweep.render_sweep_markdown(r))


@unittest.skipUnless(HAS_INSPECT, "inspect_ai not installed")
class Task(unittest.TestCase):
    def test_the_sweep_task_runs_samples_6_and_7_at_each_cap_on_the_given_hardware(self):
        from dispatch_suite import concurrency_sweep

        t = concurrency_sweep(caps="2,8", cpus=2, memory="4g")
        self.assertEqual([(s.id, s.metadata["cap"]) for s in t.dataset], [(f"{S6}@cap2", 2), (f"{S6}@cap8", 8), (f"{S7}@cap2", 2), (f"{S7}@cap8", 8)])
        self.assertEqual((t.metadata["caps"], t.metadata["cpus"], t.metadata["memory"]), ([2, 8], 2, "4g"))
        self.assertTrue(str(t.sandbox.config).endswith("compose-2cpu-4g.yaml"))

    def test_the_sweep_task_defaults_and_has_its_own_limits(self):
        from dispatch_suite import concurrency_sweep

        t = concurrency_sweep()
        self.assertEqual(sorted({s.metadata["cap"] for s in t.dataset}), [2, 4, 8])
        self.assertEqual((t.metadata["cpus"], t.epochs, t.cost_limit, t.time_limit), (4, 1, 30.0, 1800))
        self.assertEqual(concurrency_sweep(cost_limit=3.0, time_limit=60).cost_limit, 3.0)

    def test_the_routine_task_has_no_sweep_samples(self):
        from dispatch_suite import dispatch_suite

        self.assertFalse([s.id for s in dispatch_suite().dataset if "@cap" in str(s.id)])


if __name__ == "__main__":
    unittest.main()
