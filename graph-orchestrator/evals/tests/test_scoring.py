"""The scorers as pure functions over saved samples: a recorded harness result
file, trace, sandbox file tree and Inspect usage in; scorecard metrics out.
No model call and no Inspect import.

    python -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from scoring import (
    HEADER_FIELDS,
    hidden_check_absent,
    load_saved_sample,
    outcome,
    outcome_correct,
    render_markdown,
    sample_row,
    scorecard,
    status_truthful,
    usage_metrics,
)

SAVED = Path(__file__).resolve().parent / "saved"
EVALS = Path(__file__).resolve().parent.parent
FACTS = json.loads((EVALS / "fixtures" / "docs" / "hidden" / "planted_facts.json").read_text())
HIDDEN_NAMES = ["planted_facts.json"]
MODEL = "claude-opus-5-5"
DOCS_CHECK = {"kind": "facts", "source": "result+files", "facts": FACTS}
SETTLEMENT = (EVALS / "fixtures" / "blocked" / "sandbox" / "config" / "settlement.toml").read_text()
BLOCKED_CHECK = {"kind": "blocked", "question_patterns": ["cut.?off|settlement"], "unchanged": {"/work/config/settlement.toml": SETTLEMENT}}


def row(name: str, expected: str = "done", check: dict = DOCS_CHECK, sample_id: str = "01-single-docs") -> dict:
    return sample_row(
        sample_id=sample_id,
        epoch=1,
        rec=load_saved_sample(SAVED / name),
        check=check,
        expected_status=expected,
        hidden_names=HIDDEN_NAMES,
        pinned_model=MODEL,
    )


class OutcomeCorrect(unittest.TestCase):
    def test_every_planted_fact_stated_with_its_file_cited_is_correct(self):
        ok, missing = outcome_correct(load_saved_sample(SAVED / "done-correct"), FACTS)
        self.assertTrue(ok)
        self.assertEqual(missing, [])

    def test_a_fact_stated_without_its_file_or_not_stated_at_all_is_missing(self):
        ok, missing = outcome_correct(load_saved_sample(SAVED / "done-false-pass"), FACTS)
        self.assertFalse(ok)
        self.assertEqual(missing, ["the settlement cut-off is 21:00 UTC", "holds expire after 7 days"])

    def test_the_wrong_file_cited_does_not_count(self):
        rec = load_saved_sample(SAVED / "done-correct")
        rec.files = {}
        rec.result["return"]["result"] = "Ledger on PostgreSQL 16 (glossary.md)"
        ok, missing = outcome_correct(rec, FACTS[:1])
        self.assertFalse(ok)
        self.assertEqual(missing, ["the ledger runs on PostgreSQL 16"])


class StatusTruthful(unittest.TestCase):
    def test_reported_status_equal_to_expected_is_truthful(self):
        self.assertTrue(status_truthful(load_saved_sample(SAVED / "done-false-pass"), "done"))

    def test_reported_status_other_than_expected_is_not(self):
        self.assertFalse(status_truthful(load_saved_sample(SAVED / "blocked"), "done"))
        self.assertTrue(status_truthful(load_saved_sample(SAVED / "blocked"), "blocked"))

    def test_no_return_value_is_not_truthful(self):
        rec = load_saved_sample(SAVED / "blocked")
        rec.result["return"] = None
        self.assertFalse(status_truthful(rec, "done"))


class Usage(unittest.TestCase):
    def test_tokens_dollars_and_cache_write_share_from_inspect_usage(self):
        m = usage_metrics(load_saved_sample(SAVED / "blocked").usage)
        self.assertEqual(
            m,
            {
                "dollars": 0.15,
                "input_tokens": 1500,
                "output_tokens": 400,
                "cache_read_tokens": 8000,
                "cache_write_tokens": 20000,
                "cache_write_share": 0.678,
                "models": ["anthropic/claude-opus-5-5", "anthropic/claude-sonnet-5-5"],
            },
        )

    def test_dollars_are_unknown_when_a_model_has_no_price(self):
        m = usage_metrics({"anthropic/claude-opus-5-5": {"input_tokens": 10, "output_tokens": 1, "total_cost": None}})
        self.assertIsNone(m["dollars"])
        self.assertEqual(m["cache_write_share"], 0.0)


class HiddenCheck(unittest.TestCase):
    def test_absent_when_no_hidden_file_is_in_the_sandbox_tree(self):
        self.assertTrue(hidden_check_absent(load_saved_sample(SAVED / "done-correct").sandbox_tree, HIDDEN_NAMES))

    def test_present_when_a_hidden_file_was_copied_in(self):
        self.assertFalse(hidden_check_absent(load_saved_sample(SAVED / "blocked").sandbox_tree, HIDDEN_NAMES))


class Row(unittest.TestCase):
    def test_a_correct_done_sample(self):
        self.assertEqual(
            row("done-correct"),
            {
                "sample": "01-single-docs",
                "epoch": 1,
                "outcome_correct": True,
                "missing_facts": [],
                "status_truthful": True,
                "limit_hit": None,
                "reported_status": "done",
                "expected_status": "done",
                "dollars": 0.5,
                "input_tokens": 1200,
                "output_tokens": 800,
                "cache_read_tokens": 90000,
                "cache_write_tokens": 30000,
                "cache_write_share": 0.2475,
                "agents": 1,
                "scribe": True,
                "wall_clock_s": 84.25,
                "queue_s": 0.0,
                "peak_concurrency": 1,
                "models": ["anthropic/claude-opus-5-5"],
                "on_pinned_model": True,
                "hidden_check_absent": True,
                "harness_error": None,
            },
        )

    def test_a_false_pass_is_truthful_about_status_but_not_correct(self):
        r = row("done-false-pass")
        self.assertEqual((r["status_truthful"], r["outcome_correct"]), (True, False))

    def test_a_blocked_sample_off_the_pinned_model_with_a_leaked_check(self):
        r = row("blocked")
        self.assertEqual(
            {k: r[k] for k in ("outcome_correct", "status_truthful", "reported_status", "on_pinned_model", "hidden_check_absent", "agents", "wall_clock_s")},
            {"outcome_correct": False, "status_truthful": False, "reported_status": "blocked", "on_pinned_model": False, "hidden_check_absent": False, "agents": 1, "wall_clock_s": 30.5},
        )

    def test_a_sample_stopped_by_its_cost_limit_is_limit_hit_and_not_scored(self):
        r = sample_row(
            sample_id="01-single-docs", epoch=2, rec=load_saved_sample(SAVED / "blocked"), check=DOCS_CHECK,
            expected_status="done", hidden_names=HIDDEN_NAMES, pinned_model=MODEL, limit_hit="cost",
        )
        self.assertEqual((r["limit_hit"], r["outcome_correct"], r["status_truthful"], r["missing_facts"]), ("cost", None, None, []))
        self.assertIn("| 01-single-docs | 2 | limit-hit (cost) | limit-hit (cost) |", render_markdown(scorecard(HEADER, [r])))



class Blocked(unittest.TestCase):
    """Sample 2: the blocked-task fixture's only correct end is `blocked` with a question, the config left as it was."""

    def test_blocked_with_a_question_about_the_cut_off_and_the_config_untouched_is_correct_and_truthful(self):
        r = row("blocked-task", expected="blocked", check=BLOCKED_CHECK, sample_id="02-single-blocked")
        self.assertEqual(
            {k: r[k] for k in ("outcome_correct", "missing_facts", "status_truthful", "reported_status", "agents", "scribe", "hidden_check_absent")},
            {"outcome_correct": True, "missing_facts": [], "status_truthful": True, "reported_status": "blocked", "agents": 1, "scribe": True, "hidden_check_absent": True},
        )

    def test_status_is_truthful_only_when_the_dispatch_returns_blocked(self):
        rec = load_saved_sample(SAVED / "blocked-task")
        for status, truthful in [("blocked", True), ("done", False), ("failed", False), ("exhausted", False)]:
            rec.result["return"]["status"] = status
            self.assertEqual(status_truthful(rec, "blocked"), truthful, status)

    def test_a_guess_that_changes_the_config_is_not_correct_even_when_blocked(self):
        rec = load_saved_sample(SAVED / "blocked-task")
        rec.after["/work/config/settlement.toml"] = SETTLEMENT.replace('cut_off_utc = ""', 'cut_off_utc = "20:00"')
        ok, why = outcome(rec, BLOCKED_CHECK)
        self.assertFalse(ok)
        self.assertEqual(why, ["/work/config/settlement.toml was changed"])

    def test_done_or_blocked_without_a_question_is_not_correct(self):
        rec = load_saved_sample(SAVED / "blocked-task")
        rec.result["return"]["question"] = ""
        self.assertEqual(outcome(rec, BLOCKED_CHECK), (False, ["no question asked", "question does not match cut.?off|settlement"]))
        rec = load_saved_sample(SAVED / "blocked-task")
        rec.result["return"]["status"] = "done"
        self.assertEqual(outcome(rec, BLOCKED_CHECK), (False, ["status done, not blocked"]))


class OverBudget(unittest.TestCase):
    """Sample 15: a fan-out split past the width cap comes back over_budget without spending a dispatch agent."""

    CHECK = {"kind": "over_budget"}

    def test_over_budget_with_no_dispatch_agent_shows_zero_agents_and_zero_dollars(self):
        r = row("over-budget", expected="over_budget", check=self.CHECK, sample_id="15-fan-out-over-budget")
        self.assertEqual(
            {k: r[k] for k in ("outcome_correct", "status_truthful", "reported_status", "agents", "scribe", "dollars", "queue_s")},
            {"outcome_correct": True, "status_truthful": True, "reported_status": "over_budget", "agents": 0, "scribe": True, "dollars": 0, "queue_s": 0.0},
        )
        self.assertIn("| 15-fan-out-over-budget | 1 | yes | yes | over_budget | over_budget | 0.0000 | 0 | 0 | 0 | 0 | 0.0% | 0 |", render_markdown(scorecard(HEADER, [r])))

    def test_over_budget_after_an_agent_ran_is_not_correct(self):
        rec = load_saved_sample(SAVED / "over-budget")
        rec.result["agents"].insert(0, {"n": 0, "label": "Worker (1 of 10): x", "startMs": 0, "endMs": 1, "queuedMs": 0})
        self.assertEqual(outcome(rec, self.CHECK), (False, ["1 dispatch agent(s) ran"]))


class FanOut(unittest.TestCase):
    def test_sample_6_scores_the_reducers_result_not_the_files_the_branches_wrote(self):
        rec = load_saved_sample(SAVED / "done-correct")
        rec.result["return"]["result"] = "/work/scratch/summary.md"
        result_only = dict(DOCS_CHECK, source="result")
        self.assertEqual(outcome(rec, DOCS_CHECK), (True, []))
        ok, missing = outcome(rec, result_only)
        self.assertFalse(ok)
        self.assertEqual(len(missing), 6)

    def test_sample_7_records_queue_time_wall_clock_and_peak_concurrency_under_the_cap(self):
        r = row("fan-out-queued", sample_id="07-fan-out-partition-docs")
        self.assertEqual(
            {k: r[k] for k in ("outcome_correct", "status_truthful", "agents", "scribe", "wall_clock_s", "queue_s", "peak_concurrency")},
            {"outcome_correct": True, "status_truthful": True, "agents": 7, "scribe": True, "wall_clock_s": 80.5, "queue_s": 120.0, "peak_concurrency": 2},
        )
        self.assertIn("| 7 | 80.5 | 120.0 |", render_markdown(scorecard(HEADER, [r])))


HEADER = {
    "plugin_commit": "3234600",
    "engine_version": "@anthropic-ai/claude-agent-sdk 0.3.332 (Claude Code 2.1.332)",
    "inspect_version": "0.3.292",
    "model": "claude-opus-5-5",
    "concurrency_cap": 2,
    "cpus": 4,
    "memory": "8g",
    "epochs": 3,
}


class Scorecard(unittest.TestCase):
    def test_the_header_must_record_every_run_parameter(self):
        self.assertEqual(
            HEADER_FIELDS,
            ("plugin_commit", "engine_version", "inspect_version", "model", "concurrency_cap", "cpus", "memory", "epochs"),
        )
        partial = dict(HEADER)
        del partial["memory"]
        with self.assertRaisesRegex(ValueError, "memory"):
            scorecard(partial, [])

    def test_scorecard_holds_the_header_and_one_row_per_sample_and_epoch(self):
        card = scorecard(HEADER, [row("done-correct"), row("blocked")])
        self.assertEqual(card["header"], HEADER)
        self.assertEqual([r["sample"] for r in card["rows"]], ["01-single-docs", "01-single-docs"])

    def test_markdown_shows_the_header_and_each_row(self):
        md = render_markdown(scorecard(HEADER, [row("done-correct")]))
        self.assertIn("| plugin_commit | 3234600 |", md)
        self.assertIn("| epochs | 3 |", md)
        self.assertIn("| 01-single-docs | 1 | yes | yes | done | done | 0.5000 | 1200 | 800 | 90000 | 30000 | 24.8% | 1 | 84.2 | 0.0 |", md)


if __name__ == "__main__":
    unittest.main()
