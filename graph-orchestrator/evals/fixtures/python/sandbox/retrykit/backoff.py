"""Exponential backoff schedules."""


def delays(start: int, cap: int, attempts: int) -> list[int]:
    """The wait before each retry, in seconds: doubling from `start`, never above `cap`."""
    if start <= 0 or cap < start or attempts < 0:
        raise ValueError("need 0 < start <= cap and attempts >= 0")
    out, d = [], start
    for _ in range(attempts):
        out.append(min(d, cap))
        d *= 2
    return out
