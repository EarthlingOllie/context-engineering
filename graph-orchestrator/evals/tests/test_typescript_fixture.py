"""The TypeScript fixture is fit for samples 4 and 11: the obviously relevant
tests miss its planted bug and its hidden test catches it, and the diff under
review applies to the file it changes.

Runs Node's test runner on copies of the fixture. Skipped where Node 22+ is not
installed.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import suite

FIXTURE = suite.FIXTURES / "typescript"
NODE = shutil.which("node")


def _node_major() -> int:
    if not NODE:
        return 0
    out = subprocess.run([NODE, "--version"], capture_output=True, text=True).stdout.strip()
    return int(out.lstrip("v").split(".")[0])


def copy_sandbox(work: Path) -> None:
    for dest, src in suite.fixture_sandbox_files("typescript").items():
        p = work / dest.removeprefix("/work/")
        p.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, p)


def run(fixed: bool, *, hidden: bool) -> subprocess.CompletedProcess:
    """The visible tests (`npm test`'s command) or the hidden check (suite.hidden_tests_cmd), on the shipped or fixed code."""
    with tempfile.TemporaryDirectory() as d:
        work = Path(d) / "work"
        copy_sandbox(work)
        if fixed:
            shutil.copy(FIXTURE / "reference" / "fixed" / "src" / "paginate.ts", work / "src" / "paginate.ts")
        if hidden:
            check = suite.hidden_check({"fixture": "typescript"})
            dest = work / suite.HIDDEN_TESTS_DIR.removeprefix("/work/")
            dest.mkdir(parents=True)
            for f in suite.hidden_test_files("typescript"):
                shutil.copy(f, dest / f.name)
            cmd = suite.hidden_tests_cmd(check)
        else:
            cmd = ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--test", "tests/*.test.ts"]
        return subprocess.run(cmd, cwd=work, capture_output=True, text=True)


@unittest.skipUnless(_node_major() >= 22, "Node 22+ is not installed")
class TypeScriptFixture(unittest.TestCase):
    def test_the_planted_bug_passes_the_visible_tests_and_fails_the_hidden_check(self):
        self.assertEqual(run(False, hidden=False).returncode, 0)
        hidden = run(False, hidden=True)
        self.assertEqual(hidden.returncode, 1)
        self.assertIn("# fail 2", hidden.stdout)

    def test_the_fix_passes_visible_tests_and_hidden_check(self):
        self.assertEqual(run(True, hidden=False).returncode, 0)
        self.assertEqual(run(True, hidden=True).returncode, 0)


# Sample 16's criterion 2, as a test a generator could write: page through 0-50 items at sizes 1-10 following hasNext.
PAGE_THROUGH_TEST = """
import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../src/paginate.ts";

test("paging through every list reaches every item once, in order", () => {
  let ok = 0;
  for (let total = 0; total <= 50; total++) {
    for (let size = 1; size <= 10; size++) {
      const items = Array.from({ length: total }, (_, i) => i + 1);
      const seen: number[] = [];
      for (let page = 1; ; page++) {
        const p = paginate(items, page, size);
        seen.push(...p.items);
        if (!p.hasNext) break;
      }
      if (JSON.stringify(seen) === JSON.stringify(items)) ok++;
    }
  }
  assert.equal(ok, 510);
});
"""


def run_page_through(fixed: bool) -> subprocess.CompletedProcess:
    with tempfile.TemporaryDirectory() as d:
        work = Path(d) / "work"
        copy_sandbox(work)
        if fixed:
            shutil.copy(FIXTURE / "reference" / "fixed" / "src" / "paginate.ts", work / "src" / "paginate.ts")
        (work / "tests" / "pagethrough.test.ts").write_text(PAGE_THROUGH_TEST)
        cmd = ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--test", "tests/*.test.ts"]
        return subprocess.run(cmd, cwd=work, capture_output=True, text=True)


@unittest.skipUnless(_node_major() >= 22, "Node 22+ is not installed")
class CountableCriteriaCatchThePlantedBug(unittest.TestCase):
    """Sample 16: meeting its countable criteria (full suite green, 510 of 510 page-through combinations) needs the fix."""

    def test_the_shipped_code_fails_the_page_through_criterion(self):
        self.assertNotEqual(run_page_through(False).returncode, 0)

    def test_the_fix_meets_it_with_the_full_suite_green(self):
        res = run_page_through(True)
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)


@unittest.skipUnless(shutil.which("git"), "git is not installed")
class ReviewDiff(unittest.TestCase):
    def test_the_diff_under_review_applies_to_the_shipped_file(self):
        with tempfile.TemporaryDirectory() as d:
            copy_sandbox(Path(d))
            res = subprocess.run(["git", "apply", "--check", "review/0001-log-page-requests.diff"], cwd=d, capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, res.stderr)


class TypeScriptFixtureLayout(unittest.TestCase):
    def test_the_sandbox_has_the_library_its_tests_and_the_diff_but_no_hidden_test_or_reference(self):
        copied = suite.fixture_sandbox_files("typescript")
        for p in ("/work/package.json", "/work/src/paginate.ts", "/work/src/fetchPage.ts", "/work/tests/paginate.test.ts", "/work/review/0001-log-page-requests.diff"):
            self.assertIn(p, copied)
        self.assertNotIn("paginate.hidden.test.ts", {p.name for p in copied.values()})
        self.assertFalse(any("reference" in p.parts for p in copied.values()))

    def test_the_hidden_check_runs_its_test_file_with_node_after_the_dispatch(self):
        check = suite.hidden_check({"fixture": "typescript"})
        self.assertEqual((check["kind"], check["runner"], check["tests"]), ("tests", "node", ["paginate.hidden.test.ts"]))
        self.assertEqual(
            suite.hidden_tests_cmd(check),
            ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--test", "--test-reporter=tap", "hidden_check/paginate.hidden.test.ts"],
        )
        self.assertEqual(suite.hidden_tests_cmd(suite.hidden_check({"fixture": "python"})), suite.HIDDEN_TESTS_CMD)
        self.assertEqual({p.name for p in suite.hidden_files("typescript")}, {"check.json", "paginate.hidden.test.ts"})


if __name__ == "__main__":
    unittest.main()
