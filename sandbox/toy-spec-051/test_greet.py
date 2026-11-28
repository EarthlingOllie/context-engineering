import unittest

from greet import greet


class TestGreet(unittest.TestCase):
    def test_world(self):
        self.assertEqual(greet("World"), "Hello, World!")

    def test_name(self):
        self.assertEqual(greet("Ada"), "Hello, Ada!")


if __name__ == "__main__":
    unittest.main()
