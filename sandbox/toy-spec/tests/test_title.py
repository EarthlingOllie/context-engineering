import unittest

from ..toy.title import slug_title


class SlugTitleTests(unittest.TestCase):
    def test_hello_world(self):
        self.assertEqual(slug_title("hello world"), "Hello-World")

    def test_empty(self):
        self.assertEqual(slug_title(""), "")

    def test_punctuation_and_case(self):
        self.assertEqual(slug_title("  a!!!B...c  "), "A-B-C")

    def test_digits_unchanged(self):
        self.assertEqual(slug_title("route 66 west"), "Route-66-West")


if __name__ == "__main__":
    unittest.main()
