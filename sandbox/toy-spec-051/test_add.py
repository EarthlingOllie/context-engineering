import unittest

from add import add


class TestAdd(unittest.TestCase):
    def test_ints(self):
        self.assertEqual(add(2, 3), 5)

    def test_negative(self):
        self.assertEqual(add(-1, 1), 0)

    def test_floats(self):
        self.assertAlmostEqual(add(0.1, 0.2), 0.3)


if __name__ == "__main__":
    unittest.main()
