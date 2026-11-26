"""The suite's pins agree with what is installed, and the hidden check stays out of the sandbox copy."""

from __future__ import annotations

import json
import re
import unittest

import suite


class Pins(unittest.TestCase):
    def test_inspect_is_pinned_in_requirements(self):
        req = (suite.EVALS / "requirements.txt").read_text()
        self.assertIn(f"inspect_ai=={suite.INSPECT_VERSION}\n", req)

    def test_the_engine_is_pinned_in_the_sandbox_image(self):
        pkg = json.loads((suite.EVALS / "sandbox" / "package.json").read_text())
        self.assertEqual(pkg["dependencies"]["@anthropic-ai/claude-agent-sdk"], suite.SDK_VERSION)

    def test_the_model_is_pinned_declared_and_priced(self):
        self.assertEqual(suite.MODEL, "claude-opus-5-5")
        self.assertIn(suite.MODEL, suite.DECLARED_MODELS)
        self.assertEqual(set(suite.PRICES), set(suite.DECLARED_MODELS))

    def test_sample_1_runs_every_role_on_the_main_model(self):
        (s1,) = [s for s in suite.load_samples() if s["id"] == "01-single-docs"]
        text = json.dumps(s1)
        self.assertIsNone(re.search(r'"model"\s*:', text), "a sample that requests a model would leave the pinned one")


class HiddenCheckStaysOut(unittest.TestCase):
    def test_only_the_fixture_sandbox_tree_is_copied(self):
        copied = suite.fixture_sandbox_files("docs")
        self.assertEqual(sorted(copied), ["/work/docs/glossary.md", "/work/docs/ledger-service.md", "/work/docs/retry-policy.md"])

    def test_no_hidden_file_is_among_the_copied_files(self):
        hidden = {p.name for p in suite.hidden_files("docs")}
        self.assertEqual(hidden, {"planted_facts.json"})
        self.assertFalse(hidden & {p.name for p in suite.fixture_sandbox_files("docs").values()})


if __name__ == "__main__":
    unittest.main()
