"""The GitHub Actions job (observability-evals ticket 11): the workflow's inputs become run.py's options, the baseline
option is refused, a stub run needs no key, the key never reaches a log, the scorecard and Inspect log are uploaded,
and nothing is committed. No model call, no Docker.
"""

from __future__ import annotations

import io
import unittest
from contextlib import redirect_stderr
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

import ci
import run
import suite

WORKFLOW = suite.REPO / ".github" / "workflows" / "dispatch-evals.yml"


def inputs(**kw) -> dict:
    """The environment the workflow step gives ci.py: one INPUT_<NAME> per workflow input."""
    env = {"INPUT_STUB": "false", "INPUT_EPOCHS": "", "INPUT_SAMPLES": "", "INPUT_ROLE_MODELS": "", "INPUT_BASELINE": "false"}
    env.update({f"INPUT_{k.upper()}": v for k, v in kw.items()})
    return env


class InputsBecomeOptions(unittest.TestCase):
    def test_empty_inputs_are_the_routine_paid_run(self):
        self.assertEqual(ci.argv_from_inputs(inputs()), [])

    def test_stub_epochs_samples_and_role_models_pass_through(self):
        argv = ci.argv_from_inputs(
            inputs(stub="true", epochs="1", samples="01-single-docs,06-review-loop", role_models="evaluator=claude-haiku-5-5, worker=claude-opus-5-5")
        )
        self.assertEqual(
            argv,
            ["--stub", "--epochs", "1", "--samples", "01-single-docs,06-review-loop",
             "--role-model", "evaluator=claude-haiku-5-5", "--role-model", "worker=claude-opus-5-5"],
        )

    def test_the_options_are_ones_run_py_accepts(self):
        a = run.build_parser().parse_args(ci.argv_from_inputs(inputs(stub="true", epochs="2", samples="x", role_models="evaluator=m")))
        self.assertEqual((a.stub, a.epochs, a.samples, a.role_model, a.baseline), (True, 2, "x", ["evaluator=m"], False))


class RefusesWhatItMustNotRun(unittest.TestCase):
    def assertRefused(self, env: dict, says: str):
        with self.assertRaises(ci.Refused) as cm:
            ci.argv_from_inputs(env)
        self.assertIn(says, str(cm.exception))

    def test_the_baseline_option_is_refused(self):
        self.assertRefused(inputs(baseline="true"), "baseline")

    def test_an_option_smuggled_into_an_input_is_refused(self):
        self.assertRefused(inputs(samples="x --baseline"), "samples")
        self.assertRefused(inputs(role_models="evaluator=m --baseline"), "role_models")
        self.assertRefused(inputs(epochs="1 --baseline"), "epochs")

    def test_epochs_must_be_a_positive_whole_number(self):
        self.assertRefused(inputs(epochs="0"), "epochs")
        self.assertRefused(inputs(epochs="-1"), "epochs")

    def test_a_role_model_needs_role_equals_model(self):
        self.assertRefused(inputs(role_models="evaluator"), "role_models")

    def test_main_exits_2_and_never_starts_a_run_on_refusal(self):
        started = []
        err = io.StringIO()
        with redirect_stderr(err):
            code = ci.main(inputs(baseline="true"), run_main=lambda argv: started.append(argv) or 0)
        self.assertEqual((code, started), (2, []))
        self.assertIn("baseline", err.getvalue())


class KeyOnlyForPaidRuns(unittest.TestCase):
    def test_a_stub_run_starts_without_the_key(self):
        started = []
        code = ci.main(inputs(stub="true", epochs="1"), run_main=lambda argv: started.append(argv) or 0)
        self.assertEqual((code, started), (0, [["--stub", "--epochs", "1"]]))

    def test_a_paid_run_without_the_key_is_refused_before_it_starts(self):
        started = []
        with redirect_stderr(io.StringIO()) as err:
            code = ci.main(inputs(), run_main=lambda argv: started.append(argv) or 0)
        self.assertEqual((code, started), (2, []))
        self.assertIn("ANTHROPIC_API_KEY", err.getvalue())

    def test_a_paid_run_with_the_key_starts_and_never_prints_it(self):
        key = "sk-ant-test-not-a-real-key"
        started, out = [], io.StringIO()
        with redirect_stderr(out):
            code = ci.main({**inputs(epochs="1"), "ANTHROPIC_API_KEY": key}, run_main=lambda argv: started.append(argv) or 0)
        self.assertEqual((code, started), (0, [["--epochs", "1"]]))
        self.assertNotIn(key, out.getvalue())

    def test_the_run_exit_code_is_the_job_exit_code(self):
        self.assertEqual(ci.main(inputs(stub="true"), run_main=lambda argv: 1), 1)


@unittest.skipIf(yaml is None, "needs PyYAML (installed with inspect_ai)")
class Workflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text()
        cls.wf = yaml.safe_load(cls.text)
        # PyYAML reads the bare key `on` as True.
        cls.on = cls.wf.get("on", cls.wf.get(True))
        (cls.job,) = cls.wf["jobs"].values()
        cls.steps = cls.job["steps"]

    def step(self, uses_prefix: str) -> dict:
        return next(s for s in self.steps if str(s.get("uses", "")).startswith(uses_prefix))

    def run_steps(self) -> list[dict]:
        return [s for s in self.steps if "run" in s]

    def test_only_manually_triggered(self):
        self.assertEqual(set(self.on), {"workflow_dispatch"})

    def test_inputs_map_to_the_suite_options(self):
        self.assertEqual(set(self.on["workflow_dispatch"]["inputs"]), {"stub", "epochs", "samples", "role_models", "baseline"})
        self.assertEqual(self.on["workflow_dispatch"]["inputs"]["stub"]["type"], "boolean")
        self.assertIs(self.on["workflow_dispatch"]["inputs"]["baseline"]["default"], False)

    def test_runs_on_a_hosted_runner_with_docker(self):
        self.assertEqual(self.job["runs-on"], "ubuntu-latest")
        self.assertTrue(any("docker" in s["run"] for s in self.run_steps()), "a step checks Docker is there")

    def test_the_suite_runs_through_ci_py_with_inputs_only_as_environment(self):
        (suite_step,) = [s for s in self.run_steps() if "evals/ci.py" in s["run"]]
        self.assertEqual(
            {k for k in suite_step["env"] if k.startswith("INPUT_")}, {"INPUT_STUB", "INPUT_EPOCHS", "INPUT_SAMPLES", "INPUT_ROLE_MODELS", "INPUT_BASELINE"}
        )
        for s in self.run_steps():
            self.assertNotIn("${{", s["run"], f"no expression is pasted into a shell script: {s.get('name')}")

    def test_the_key_comes_from_a_repository_secret_only_for_paid_runs_and_is_never_echoed(self):
        (suite_step,) = [s for s in self.run_steps() if "evals/ci.py" in s["run"]]
        self.assertEqual(suite_step["env"]["ANTHROPIC_API_KEY"], "${{ !inputs.stub && secrets.ANTHROPIC_API_KEY || '' }}")
        self.assertEqual(self.text.count("secrets."), 1, "the secret is read in exactly one place")
        for s in self.run_steps():
            self.assertNotIn("ANTHROPIC_API_KEY", s["run"])
            self.assertNotIn("set -x", s["run"])

    def test_scorecard_and_inspect_log_are_uploaded_even_when_the_run_fails(self):
        uploads = [s for s in self.steps if str(s.get("uses", "")).startswith("actions/upload-artifact@")]
        paths = "\n".join(s["with"]["path"] for s in uploads)
        self.assertIn("graph-orchestrator/evals/out/scorecards/", paths)
        self.assertIn("graph-orchestrator/evals/logs/", paths)
        for s in uploads:
            self.assertEqual(s["if"], "always()")

    def test_commits_nothing(self):
        self.assertEqual(self.wf["permissions"], {"contents": "read"})
        self.assertIs(self.step("actions/checkout@")["with"]["persist-credentials"], False)
        for s in self.run_steps():
            for word in ("git commit", "git push", "git tag", "--baseline"):
                self.assertNotIn(word, s["run"])

    def test_actions_are_pinned_to_a_major_version(self):
        for s in self.steps:
            if "uses" in s:
                self.assertRegex(s["uses"], r"^[\w-]+/[\w-]+@v\d+$")


if __name__ == "__main__":
    unittest.main()
