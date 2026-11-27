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
    cost_by_role,
    false_passes,
    hidden_test_counts,
    pytest_counts,
    role_of,
    hidden_check_absent,
    load_saved_sample,
    model_routing,
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
        prices=PRICES,
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
                "false_pass": False,
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
                "demand": None,
                "scribe": True,
                "wall_clock_s": 84.25,
                "queue_s": 0.0,
                "peak_concurrency": 1,
                "models": ["anthropic/claude-opus-5-5"],
                "on_pinned_model": True,
                "models_by_role": {
                    "worker": {"requested": ["claude-opus-5-5"], "served": []},
                    "scribe": {"requested": ["claude-opus-5-5"], "served": []},
                },
                "misrouted": [],
                "routing_ok": True,
                "hidden_check_absent": True,
                "harness_error": None,
                "by_role": {
                    "worker": {"agents": 1, "dollars": 0.0, "input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0},
                    "scribe": {"agents": 1, "dollars": 0.0, "input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0},
                },
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
        self.assertIn("| 15-fan-out-over-budget | 1 | yes | yes | no | over_budget | over_budget | 0.0000 | 0 | 0 | 0 | 0 | 0.0% | 0 |", render_markdown(scorecard(HEADER, [r])))

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
        self.assertIn("| 7 | - | 80.5 | 120.0 |", render_markdown(scorecard(HEADER, [r])))


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


PY_CHECK = {"kind": "tests", "tests": ["test_duration_strict.py"]}


class HiddenTests(unittest.TestCase):
    """Samples 3 and 8: outcome correct only when the fixture's hidden tests, run after the dispatch, pass."""

    def test_sample_3_is_not_correct_when_the_hidden_tests_fail_even_though_it_reports_done(self):
        r = row("hidden-tests-fail", check=PY_CHECK, sample_id="03-generator-evaluator-python")
        self.assertEqual((r["reported_status"], r["status_truthful"], r["outcome_correct"]), ("done", True, False))
        self.assertEqual(r["missing_facts"], ["hidden tests: 27 failed, 18 passed (exit 1)"])

    def test_sample_8_is_correct_when_every_hidden_test_passes(self):
        r = row("hidden-tests-pass", check=PY_CHECK, sample_id="08-chain-single-then-ge-python")
        self.assertEqual((r["outcome_correct"], r["missing_facts"], r["status_truthful"]), (True, [], True))

    def test_hidden_tests_that_never_ran_or_collected_nothing_are_not_correct(self):
        rec = load_saved_sample(SAVED / "hidden-tests-pass")
        rec.hidden_tests = None
        self.assertEqual(outcome(rec, PY_CHECK), (False, ["hidden tests did not run"]))
        rec.hidden_tests = {"exit_code": 5, "output": "no tests ran in 0.01s"}
        self.assertEqual(outcome(rec, PY_CHECK), (False, ["hidden tests: 0 passed (exit 5)"]))

    def test_pytest_counts_read_the_summary_line(self):
        self.assertEqual(pytest_counts("..F\n1 failed, 2 passed, 1 error in 0.1s"), {"passed": 2, "failed": 1, "errors": 1})
        self.assertEqual(pytest_counts("45 passed in 0.03s"), {"passed": 45, "failed": 0, "errors": 0})


class Exhausted(unittest.TestCase):
    """Sample 5: unmeetable criteria and 2 rounds; the only truthful end is exhausted after both rounds."""

    CHECK = {"kind": "exhausted", "rounds": 2}

    def test_the_saved_exhausted_sample_is_correct_and_truthful_after_2_rounds_of_generator_and_evaluator(self):
        r = row("exhausted", expected="exhausted", check=self.CHECK, sample_id="05-generator-evaluator-exhausted")
        self.assertEqual(
            {k: r[k] for k in ("outcome_correct", "missing_facts", "status_truthful", "reported_status", "agents")},
            {"outcome_correct": True, "missing_facts": [], "status_truthful": True, "reported_status": "exhausted", "agents": 4},
        )
        self.assertEqual({k: v["agents"] for k, v in r["by_role"].items()}, {"generator": 2, "evaluator": 2, "scribe": 1})

    def test_done_is_not_truthful_and_exhausted_before_the_last_round_is_not_correct(self):
        rec = load_saved_sample(SAVED / "exhausted")
        rec.result["return"]["status"] = "done"
        self.assertFalse(status_truthful(rec, "exhausted"))
        self.assertEqual(outcome(rec, self.CHECK), (False, ["status done, not exhausted"]))
        rec = load_saved_sample(SAVED / "exhausted")
        rec.result["return"]["iterations"] = 1
        self.assertEqual(outcome(rec, self.CHECK), (False, ["exhausted after 1 round(s), not 2"]))


class ChainStop(unittest.TestCase):
    """Sample 9: the chain stops at stage 2 and reports that stage and its status; stage 3 never runs."""

    CHECK = {"kind": "chain_stop", "stage": 2, "status": "exhausted", "stages": 3}

    def test_a_chain_that_stops_at_stage_2_and_reports_it_is_correct_and_truthful(self):
        r = row("chain-stage-2-stopped", expected="exhausted", check=self.CHECK, sample_id="09-chain-stage-2-fails")
        self.assertEqual((r["outcome_correct"], r["missing_facts"], r["status_truthful"], r["agents"]), (True, [], True, 3))

    def test_a_chain_that_reports_the_stage_on_its_stage_line_is_correct(self):
        rec = load_saved_sample(SAVED / "chain-stage-2-stopped")
        rec.result["return"]["result"] = 'w1-d9-s1 done: /work/scratch/plan.md\nw1-d9-s2 exhausted: changed duration.py\nnot run: w1-d9-s3 "Announce parse_duration"'
        self.assertEqual(outcome(rec, self.CHECK), (True, []))

    def test_a_chain_that_reports_another_stage_or_status_or_runs_on_is_not_correct(self):
        rec = load_saved_sample(SAVED / "chain-stage-2-stopped")
        rec.result["return"]["stages"] = ["w1-d9-s1:done"]
        rec.result["return"]["result"] = "stage w1-d9-s1 exhausted: x"
        ok, why = outcome(rec, self.CHECK)
        self.assertFalse(ok)
        self.assertEqual(why, ["stages reported ['w1-d9-s1:done'], not stage 2 last", "result does not name stage w1-d9-s2 exhausted"])
        rec = load_saved_sample(SAVED / "chain-stage-2-stopped")
        rec.result["agents"].insert(-1, {"label": "Link 3 · Single, Worker: Write the release note", "engine": None})
        self.assertEqual(outcome(rec, self.CHECK), (False, ["a stage after stage 2 ran"]))
        rec = load_saved_sample(SAVED / "chain-stage-2-stopped")
        rec.result["return"]["status"] = "failed"
        self.assertEqual(outcome(rec, self.CHECK)[1][0], "status failed, not exhausted")


PRICES = {
    "claude-opus-5-5": {"input": 4.0, "output": 20.0, "input_cache_write": 5.0, "input_cache_read": 0.20},
    "claude-haiku-5-5": {"input": 0.10, "output": 0.50, "input_cache_write": 0.125, "input_cache_read": 0.01},
}


class CostByRole(unittest.TestCase):
    """Dollars and tokens per role, from each agent's engine record and the run's prices."""

    def rec(self):
        rec = load_saved_sample(SAVED / "exhausted")
        opus = {"claude-opus-5-5": {"inputTokens": 1000, "outputTokens": 2000, "cacheReadInputTokens": 100000, "cacheCreationInputTokens": 20000, "costUSD": 9.9}}
        engines = [
            {"result": {"modelUsage": opus}},  # generator round 1: $0.164
            {"result": {"usage": {"input_tokens": 500, "output_tokens": 1000, "cache_read_input_tokens": 50000, "cache_creation_input_tokens": 0}}},  # evaluator: $0.032 on the agent's model
            {"result": {"modelUsage": opus}},  # generator round 2: $0.164
            {"result": {"modelUsage": {"anthropic/claude-haiku-5-5": {"inputTokens": 1000000, "outputTokens": 0, "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0}}}},  # evaluator: $0.10
            None,  # the scribe's engine reported nothing
        ]
        for a, e in zip(rec.result["agents"], engines):
            a["engine"] = e
        return rec

    def test_roles_are_read_from_agent_labels_including_chain_stage_labels(self):
        self.assertEqual(role_of("Generator (1 of 2): Add parse_duration"), "generator")
        self.assertEqual(role_of("Link 2 · Generator-evaluator, Evaluator (1 of 3): Add parse"), "evaluator")
        self.assertEqual(role_of("Link 1 · Single, Worker: Plan"), "worker")
        self.assertEqual(role_of("Grapher: logging current dispatch"), "scribe")
        self.assertEqual(role_of("Debater pro (round 1 of 2)"), "debater")
        self.assertEqual(role_of(None), "unlabelled")

    def test_dollars_and_tokens_are_summed_per_role_at_the_run_prices_not_the_engine_own_cost(self):
        by = cost_by_role(self.rec(), PRICES)
        self.assertEqual(
            by,
            {
                "generator": {"agents": 2, "dollars": 0.328, "input_tokens": 2000, "output_tokens": 4000, "cache_read_tokens": 200000, "cache_write_tokens": 40000},
                "evaluator": {"agents": 2, "dollars": 0.132, "input_tokens": 1000500, "output_tokens": 1000, "cache_read_tokens": 50000, "cache_write_tokens": 0},
                "scribe": {"agents": 1, "dollars": 0.0, "input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0},
            },
        )

    def test_a_role_served_by_an_unpriced_model_has_unknown_dollars(self):
        rec = self.rec()
        rec.result["agents"][0]["engine"] = {"result": {"modelUsage": {"some-other-model": {"inputTokens": 10, "outputTokens": 10}}}}
        by = cost_by_role(rec, PRICES)
        self.assertIsNone(by["generator"]["dollars"])
        self.assertEqual(by["evaluator"]["dollars"], 0.132)

    def test_the_markdown_scorecard_shows_cost_by_role(self):
        r = sample_row(
            sample_id="05-generator-evaluator-exhausted", epoch=1, rec=self.rec(), check={"kind": "exhausted", "rounds": 2},
            expected_status="exhausted", hidden_names=[], pinned_model=MODEL, prices=PRICES,
        )
        md = render_markdown(scorecard(HEADER, [r]))
        self.assertIn("| sample | epoch | role | agents | $ | in | out | cache read | cache write |", md)
        self.assertIn("| 05-generator-evaluator-exhausted | 1 | generator | 2 | 0.3280 | 2000 | 4000 | 200000 | 40000 |", md)
        self.assertIn("| 05-generator-evaluator-exhausted | 1 | evaluator | 2 | 0.1320 | 1000500 | 1000 | 50000 | 0 |", md)


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
        self.assertIn("| 01-single-docs | 1 | yes | yes | no | done | done | 0.5000 | 1200 | 800 | 90000 | 30000 | 24.8% | 1 | - | 84.2 | 0.0 |", md)


TS_CHECK = {"kind": "tests", "runner": "node", "tests": ["paginate.hidden.test.ts"]}
PANEL_CHECK = {"kind": "verdict", "verdict": "FAIL", "lens": "security"}


class FalsePass(unittest.TestCase):
    """Sample 4: a false pass is the dispatch returning done while its hidden check fails."""

    def test_the_saved_sample_4_false_pass_is_done_truthful_not_correct_and_counted_as_a_false_pass(self):
        r = row("ts-false-pass", check=TS_CHECK, sample_id="04-generator-evaluator-false-pass")
        self.assertEqual(
            {k: r[k] for k in ("reported_status", "status_truthful", "outcome_correct", "false_pass", "missing_facts")},
            {"reported_status": "done", "status_truthful": True, "outcome_correct": False, "false_pass": True, "missing_facts": ["hidden tests: 2 failed, 1 passed (exit 1)"]},
        )

    def test_done_and_correct_is_not_a_false_pass_and_neither_is_another_status(self):
        self.assertFalse(row("done-correct")["false_pass"])
        self.assertFalse(row("blocked")["false_pass"])
        self.assertFalse(row("exhausted", expected="exhausted", check={"kind": "exhausted", "rounds": 1})["false_pass"])

    def test_sample_4_is_not_a_false_pass_once_the_hidden_check_passes(self):
        rec = load_saved_sample(SAVED / "ts-false-pass")
        rec.hidden_tests = {"exit_code": 0, "output": "1..3\n# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n"}
        r = sample_row(sample_id="04", epoch=1, rec=rec, check=TS_CHECK, expected_status="done", hidden_names=[], pinned_model=MODEL)
        self.assertEqual((r["outcome_correct"], r["false_pass"]), (True, False))

    def test_a_limit_hit_sample_is_not_scored_for_false_pass_either(self):
        r = sample_row(
            sample_id="04", epoch=1, rec=load_saved_sample(SAVED / "ts-false-pass"), check=TS_CHECK,
            expected_status="done", hidden_names=[], pinned_model=MODEL, limit_hit="time",
        )
        self.assertIsNone(r["false_pass"])

    def test_node_test_runner_counts_are_read_from_its_tap_summary(self):
        self.assertEqual(hidden_test_counts("ok 1 - a\n1..3\n# tests 3\n# suites 0\n# pass 1\n# fail 2\n# cancelled 0\n# duration_ms 8\n"), {"passed": 1, "failed": 2, "errors": 0})
        self.assertEqual(hidden_test_counts("# pass 2\n# fail 0\n# cancelled 1\n"), {"passed": 2, "failed": 0, "errors": 1})
        self.assertEqual(hidden_test_counts("1 failed, 2 passed in 0.1s"), {"passed": 2, "failed": 1, "errors": 0})


class FalsePassesInTheScorecard(unittest.TestCase):
    def rows(self):
        r4 = lambda epoch, name: {**row(name, check=TS_CHECK, sample_id="04-generator-evaluator-false-pass"), "epoch": epoch}  # noqa: E731
        r11 = lambda epoch, name: {**row(name, check=PANEL_CHECK, sample_id="11-panel-diff-defect"), "epoch": epoch}  # noqa: E731
        return [r4(1, "ts-false-pass"), r4(2, "ts-false-pass"), r11(1, "panel-fail-security"), r11(2, "panel-pass"), row("done-correct")]

    def test_false_passes_are_counted_per_sample_over_its_scored_epochs_and_as_a_suite_total(self):
        self.assertEqual(
            false_passes(self.rows()),
            {
                "by_sample": {
                    "04-generator-evaluator-false-pass": {"false_passes": 2, "scored": 2},
                    "11-panel-diff-defect": {"false_passes": 1, "scored": 2},
                    "01-single-docs": {"false_passes": 0, "scored": 1},
                },
                "total": 3,
                "scored": 5,
            },
        )

    def test_limit_hit_rows_are_not_scored(self):
        lim = sample_row(
            sample_id="04-generator-evaluator-false-pass", epoch=3, rec=load_saved_sample(SAVED / "ts-false-pass"), check=TS_CHECK,
            expected_status="done", hidden_names=[], pinned_model=MODEL, limit_hit="cost",
        )
        got = false_passes([row("ts-false-pass", check=TS_CHECK, sample_id="04-generator-evaluator-false-pass"), lim])
        self.assertEqual(got["by_sample"]["04-generator-evaluator-false-pass"], {"false_passes": 1, "scored": 1})

    def test_the_scorecard_carries_the_false_pass_totals_and_the_markdown_shows_them_per_row_per_sample_and_for_the_suite(self):
        card = scorecard(HEADER, self.rows())
        self.assertEqual(card["false_passes"]["total"], 3)
        md = render_markdown(card)
        self.assertIn("| sample | epoch | correct | truthful | false pass |", md)
        self.assertIn("| 04-generator-evaluator-false-pass | 1 | no | yes | yes | done | done |", md)
        self.assertIn("| 11-panel-diff-defect | 1 | yes | yes | no | done | done |", md)
        self.assertIn("False passes (done reported while the hidden check failed)", md)
        self.assertIn("| 04-generator-evaluator-false-pass | 2 of 2 |", md)
        self.assertIn("| 11-panel-diff-defect | 1 of 2 |", md)
        self.assertIn("| suite total | 3 of 5 |", md)


class PanelVerdict(unittest.TestCase):
    """Sample 11: correct only on a FAIL verdict that names the defect's lens."""

    def test_a_fail_verdict_naming_the_security_lens_is_correct(self):
        r = row("panel-fail-security", check=PANEL_CHECK, sample_id="11-panel-diff-defect")
        self.assertEqual((r["outcome_correct"], r["missing_facts"], r["status_truthful"], r["false_pass"]), (True, [], True, False))
        self.assertEqual({k: v["agents"] for k, v in r["by_role"].items()}, {"evaluator": 3, "scribe": 1})

    def test_a_pass_verdict_on_the_defective_diff_is_a_false_pass(self):
        r = row("panel-pass", check=PANEL_CHECK, sample_id="11-panel-diff-defect")
        self.assertEqual((r["outcome_correct"], r["missing_facts"], r["false_pass"]), (False, ["verdict PASS, not FAIL"], True))

    def test_a_fail_verdict_that_does_not_name_the_defects_lens_is_not_correct(self):
        rec = load_saved_sample(SAVED / "panel-fail-security")
        rec.result["return"]["result"] = "FAIL (2/3)\n[readability] FAIL: 1. console.debug is called inline"
        self.assertEqual(outcome(rec, PANEL_CHECK), (False, ["FAIL verdict does not name the security lens"]))

    def test_a_lens_line_cut_off_by_the_line_limit_is_not_named(self):
        rec = load_saved_sample(SAVED / "panel-fail-security")
        rec.result["return"]["result"] = "FAIL (0/3)\n[correctness] FAIL: 1. x\n[readability] FAIL: 1. y"
        self.assertFalse(outcome(rec, PANEL_CHECK)[0])
        rec.result["return"]["result"] = "FAIL (2/3)\n[Security] fail: 1. the token is logged"
        self.assertEqual(outcome(rec, PANEL_CHECK), (True, []))

    def test_a_panel_that_did_not_return_done_is_not_correct(self):
        rec = load_saved_sample(SAVED / "panel-fail-security")
        rec.result["return"]["status"] = "blocked"
        self.assertEqual(outcome(rec, PANEL_CHECK), (False, ["status blocked, not done"]))


if __name__ == "__main__":
    unittest.main()


class ModelRouting(unittest.TestCase):
    """Ticket 09: per role, the model each agent was requested on and the model that served its calls."""

    def rec(self, evaluator_served: list[str], evaluator_requested: str = "claude-haiku-5-5"):
        rec = load_saved_sample(SAVED / "exhausted")
        calls = lambda *ms: {"calls": [{"model": m, "usage": None} for m in ms]}  # noqa: E731
        agents = rec.result["agents"]
        agents[0]["engine"] = calls("claude-opus-5-5", "claude-opus-5-5")  # generator round 1
        agents[1]["model"] = evaluator_requested
        agents[1]["engine"] = calls(*evaluator_served)  # evaluator round 1
        agents[2]["engine"] = calls("claude-opus-5-5")  # generator round 2
        agents[3]["model"] = evaluator_requested
        agents[3]["engine"] = calls(evaluator_requested)  # evaluator round 2
        agents[4]["engine"] = None  # the scribe's engine reported nothing
        return rec

    def row(self, rec, limit_hit=None):
        return sample_row(
            sample_id="05-generator-evaluator-exhausted", epoch=1, rec=rec, check={"kind": "exhausted", "rounds": 2},
            expected_status="exhausted", hidden_names=[], pinned_model=MODEL, prices=PRICES, limit_hit=limit_hit,
        )

    def test_requested_and_serving_model_are_recorded_per_role(self):
        self.assertEqual(
            model_routing(self.rec(["claude-haiku-5-5"]))["by_role"],
            {
                "generator": {"requested": ["claude-opus-5-5"], "served": ["claude-opus-5-5"]},
                "evaluator": {"requested": ["claude-haiku-5-5"], "served": ["claude-haiku-5-5"]},
                "scribe": {"requested": ["claude-opus-5-5"], "served": []},
            },
        )

    def test_the_serving_model_is_read_from_the_engine_usage_when_no_call_was_recorded(self):
        rec = self.rec(["claude-haiku-5-5"])
        rec.result["agents"][1]["engine"] = {"result": {"modelUsage": {"anthropic/claude-haiku-5-5": {"inputTokens": 5}}}}
        self.assertEqual(model_routing(rec)["by_role"]["evaluator"]["served"], ["claude-haiku-5-5"])

    def test_a_role_served_on_the_model_it_requested_keeps_the_sample_correct(self):
        r = self.row(self.rec(["claude-haiku-5-5"]))
        self.assertEqual((r["routing_ok"], r["misrouted"], r["outcome_correct"], r["missing_facts"]), (True, [], True, []))
        self.assertEqual(r["models_by_role"]["evaluator"], {"requested": ["claude-haiku-5-5"], "served": ["claude-haiku-5-5"]})

    def test_a_sample_fails_when_any_call_is_served_by_another_model_than_requested(self):
        r = self.row(self.rec(["claude-haiku-5-5", "claude-opus-5-5"]))
        self.assertEqual(r["routing_ok"], False)
        self.assertEqual(r["outcome_correct"], False)
        self.assertEqual(r["status_truthful"], True)
        self.assertEqual(r["misrouted"], [{"agent": 2, "role": "evaluator", "requested": "claude-haiku-5-5", "served": ["claude-opus-5-5"]}])
        self.assertEqual(r["missing_facts"], ["model routing: evaluator agent 2 requested claude-haiku-5-5, served by claude-opus-5-5"])

    def test_a_misrouted_sample_is_not_counted_as_a_false_pass(self):
        r = self.row(self.rec(["claude-opus-5-5"]))
        self.assertEqual((r["outcome_correct"], r["false_pass"]), (False, False))

    def test_a_limit_hit_sample_is_not_scored_for_routing_but_still_shows_its_models(self):
        r = self.row(self.rec(["claude-opus-5-5"]), limit_hit="cost")
        self.assertIsNone(r["routing_ok"])
        self.assertIsNone(r["outcome_correct"])
        self.assertEqual(r["models_by_role"]["evaluator"]["served"], ["claude-haiku-5-5", "claude-opus-5-5"])

    def test_the_markdown_scorecard_shows_requested_and_serving_model_per_role(self):
        md = render_markdown(scorecard(HEADER, [self.row(self.rec(["claude-opus-5-5"]))]))
        self.assertIn("| sample | epoch | role | requested | served | routed |", md)
        self.assertIn("| 05-generator-evaluator-exhausted | 1 | generator | claude-opus-5-5 | claude-opus-5-5 | yes |", md)
        self.assertIn("| 05-generator-evaluator-exhausted | 1 | evaluator | claude-haiku-5-5 | claude-haiku-5-5, claude-opus-5-5 | no |", md)
        self.assertIn("| 05-generator-evaluator-exhausted | 1 | scribe | claude-opus-5-5 | - | yes |", md)


# ---- ticket 08: iterative fan-out, best-of-n, debate and relay ----
import suite  # noqa: E402
from scoring import chosen_candidate  # noqa: E402


def _sample(sid: str) -> dict:
    (s,) = [s for s in suite.load_samples() if s["id"] == sid]
    return s


def _row(name: str, sid: str, rec=None, **kw) -> dict:
    s = _sample(sid)
    return sample_row(
        sample_id=sid, epoch=1, rec=rec or load_saved_sample(SAVED / name), check=suite.hidden_check(s), expected_status=s["expected_status"],
        hidden_names=[p.name for p in suite.hidden_files(s["fixture"])], pinned_model=MODEL, prices=PRICES, dispatch=s["args"]["dispatch"], **kw,
    )


class IterativeCoverage(unittest.TestCase):
    """Sample 10: full coverage only in round 2; the reducer's result scored against the planted facts."""

    def test_done_in_round_2_with_every_planted_fact_in_the_result_is_correct(self):
        r = _row("coverage-round-2", "10-iterative-fan-out-docs-gap")
        self.assertEqual((r["outcome_correct"], r["missing_facts"], r["status_truthful"]), (True, [], True))

    def test_done_in_round_1_did_not_need_the_second_round_so_the_gap_was_missed(self):
        r = _row("coverage-round-1", "10-iterative-fan-out-docs-gap")
        self.assertFalse(r["outcome_correct"])
        self.assertEqual(r["missing_facts"][0], "done after 1 round(s), not 2")
        self.assertTrue(r["false_pass"])

    def test_the_runbook_facts_missing_from_the_result_fail_it(self):
        rec = load_saved_sample(SAVED / "coverage-round-2")
        rec.result["return"]["result"] = "\n".join(l for l in rec.result["return"]["result"].splitlines() if "payout-failures" not in l)
        r = _row("", "10-iterative-fan-out-docs-gap", rec=rec)
        self.assertEqual(r["missing_facts"], ["a rejected payout is retried 3 times", "after the third failure the payout is held and finance-ops paged"])

    def test_exhausted_is_not_correct(self):
        rec = load_saved_sample(SAVED / "coverage-round-2")
        rec.result["return"]["status"] = "exhausted"
        self.assertEqual(outcome(rec, suite.hidden_check(_sample("10-iterative-fan-out-docs-gap"))), (False, ["status exhausted, not done"]))


class ChosenCandidate(unittest.TestCase):
    """Sample 12: correct only when the candidate the judge chose passes the hidden tests."""

    def test_the_chosen_candidate_is_the_judges_chosen_index(self):
        self.assertEqual(chosen_candidate(load_saved_sample(SAVED / "best-of-n-chosen")), 1)

    def test_without_chosen_the_first_index_named_in_the_verdict(self):
        rec = load_saved_sample(SAVED / "best-of-n-chosen")
        judge = next(a for a in rec.result["agents"] if a["role"] == "judge")
        del judge["output"]["chosen"]
        rec.result["return"]["result"] = "[3] /work/scratch/w1-d12-c3/feekit/allocate.py\nbeats [1]"
        self.assertEqual(chosen_candidate(rec), 3)

    def test_no_candidate_when_the_judge_named_none(self):
        rec = load_saved_sample(SAVED / "best-of-n-chosen")
        next(a for a in rec.result["agents"] if a["role"] == "judge")["output"] = {"verdict": "all fine"}
        rec.result["return"]["result"] = "all fine"
        self.assertIsNone(chosen_candidate(rec))
        r = _row("", "12-best-of-n-python-bug", rec=rec)
        self.assertEqual((r["outcome_correct"], r["missing_facts"]), (False, ["the judge named no candidate"]))

    def test_the_chosen_candidate_passing_the_hidden_tests_is_correct(self):
        r = _row("best-of-n-chosen", "12-best-of-n-python-bug")
        self.assertEqual((r["outcome_correct"], r["missing_facts"], r["status_truthful"], r["false_pass"]), (True, [], True, False))

    def test_the_chosen_candidate_failing_the_hidden_tests_is_a_false_pass(self):
        rec = load_saved_sample(SAVED / "best-of-n-chosen")
        rec.hidden_tests = {"exit_code": 1, "output": "35 failed, 37 passed in 0.10s\n", "candidate": 1}
        r = _row("", "12-best-of-n-python-bug", rec=rec)
        self.assertEqual((r["outcome_correct"], r["false_pass"]), (False, True))
        self.assertEqual(r["missing_facts"], ["candidate 1: hidden tests: 35 failed, 37 passed (exit 1)"])

    def test_hidden_tests_run_on_another_candidate_do_not_count(self):
        rec = load_saved_sample(SAVED / "best-of-n-chosen")
        rec.hidden_tests = {**rec.hidden_tests, "candidate": 2}
        self.assertEqual(outcome(rec, suite.hidden_check(_sample("12-best-of-n-python-bug"))), (False, ["hidden tests ran on candidate 2, not the chosen candidate 1"]))


class ContractVerdict(unittest.TestCase):
    """Sample 13: scored by a verdict in the return contract; agents recorded against the catalog's demand."""

    def test_one_option_on_line_1_within_the_line_limit_is_correct(self):
        r = _row("debate-verdict", "13-debate-design")
        self.assertEqual((r["outcome_correct"], r["missing_facts"]), (True, []))

    def test_the_agent_count_is_recorded_against_the_demand_formula(self):
        r = _row("debate-verdict", "13-debate-design")
        self.assertEqual((r["agents"], r["demand"]), (5, 5))
        md = render_markdown(scorecard(HEADER, [r]))
        self.assertIn("| agents | demand |", md)
        self.assertIn("| 5 | 5 |", md)

    def test_no_option_or_both_options_on_line_1_is_not_a_verdict(self):
        check = suite.hidden_check(_sample("13-debate-design"))
        rec = load_saved_sample(SAVED / "debate-verdict")
        rec.result["return"]["result"] = "[1] stub: no model call was made"
        self.assertEqual(outcome(rec, check), (False, ["line 1 names none of postgres, redis"]))
        rec.result["return"]["result"] = "postgres or redis, it depends"
        self.assertEqual(outcome(rec, check), (False, ["line 1 names more than one of postgres, redis"]))

    def test_a_verdict_past_the_line_limit_is_not_in_the_contract(self):
        check = {**suite.hidden_check(_sample("13-debate-design")), "max_lines": 2}
        rec = load_saved_sample(SAVED / "debate-verdict")
        rec.result["return"]["result"] = "redis\nreason\nmore"
        self.assertEqual(outcome(rec, check), (False, ["3 lines, past the 2-line contract"]))


class RelayHandOver(unittest.TestCase):
    """Sample 14: done within 3 sessions, the progress file rewritten in each, and the hidden tests pass."""

    def test_done_with_the_progress_file_rewritten_and_the_hidden_tests_passing_is_correct(self):
        r = _row("relay-done", "14-relay-python-features")
        self.assertEqual((r["outcome_correct"], r["missing_facts"], r["status_truthful"]), (True, [], True))

    def test_a_session_that_left_the_progress_file_as_it_was_fails_the_hand_over(self):
        rec = load_saved_sample(SAVED / "relay-done")
        w = rec.result["agents"][0]["watched"]["/work/scratch/progress.md"]
        w["after"] = w["before"]
        r = _row("", "14-relay-python-features", rec=rec)
        self.assertEqual(r["missing_facts"], ["session 1 did not rewrite /work/scratch/progress.md"])

    def test_a_run_without_the_progress_file_watched_is_not_correct(self):
        rec = load_saved_sample(SAVED / "relay-done")
        for a in rec.result["agents"]:
            a.pop("watched", None)
        self.assertIn("session 1 did not rewrite /work/scratch/progress.md", outcome(rec, suite.hidden_check(_sample("14-relay-python-features")))[1])

    def test_exhausted_after_3_sessions_each_rewriting_the_file_is_still_not_done(self):
        r = _row("relay-exhausted", "14-relay-python-features")
        self.assertEqual(r["outcome_correct"], False)
        self.assertEqual(r["missing_facts"][0], "status exhausted, not done")
        self.assertNotIn("did not rewrite", " ".join(r["missing_facts"]))

    def test_more_sessions_than_allowed_or_failing_hidden_tests_are_not_correct(self):
        check = suite.hidden_check(_sample("14-relay-python-features"))
        rec = load_saved_sample(SAVED / "relay-done")
        rec.result["return"]["iterations"] = 4
        self.assertEqual(outcome(rec, check)[1], ["done after 4 session(s), more than 3"])
        rec = load_saved_sample(SAVED / "relay-done")
        rec.hidden_tests = {"exit_code": 1, "output": "27 failed, 18 passed in 0.10s\n"}
        self.assertEqual(outcome(rec, check)[1], ["hidden tests: 27 failed, 18 passed (exit 1)"])
