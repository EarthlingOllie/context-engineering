import unittest

from ..toy.slugify import slugify


class SlugifyTests(unittest.TestCase):
    def test_hello_world(self):
        self.assertEqual(slugify("Hello World"), "hello-world")

    def test_already_slugged_with_padding(self):
        self.assertEqual(slugify("  --Already--Slugged--  "), "already-slugged")

    def test_empty(self):
        self.assertEqual(slugify(""), "")

    def test_punctuation_run_collapses(self):
        self.assertEqual(slugify("a!!!b...c"), "a-b-c")


if __name__ == "__main__":
    unittest.main()
