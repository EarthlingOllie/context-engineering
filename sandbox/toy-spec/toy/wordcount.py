"""Word counting (ticket T2)."""


def count_words(s: str) -> int:
    """Return the number of whitespace-separated tokens in s."""
    return len(s.split())
