import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from toy.wordcount import count_words  # noqa: E402


class CountWordsTest(unittest.TestCase):
    def test_multiple_spaces(self):
        self.assertEqual(count_words("one two  three"), 3)

    def test_empty_string(self):
        self.assertEqual(count_words(""), 0)

    def test_whitespace_only(self):
        self.assertEqual(count_words("   "), 0)


if __name__ == "__main__":
    unittest.main()
