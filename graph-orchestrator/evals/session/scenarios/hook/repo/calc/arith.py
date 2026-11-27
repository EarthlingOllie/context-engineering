def add(a, b):
    return a + b


def subtract(a, b):
    return a - b


def multiply(a, b):
    return a * b


def divide(a, b):
    if b == 0:
        raise ZeroDivisionError("divide by zero")
    return a / b


def mean(xs):
    if not xs:
        raise ValueError("mean of an empty list")
    return sum(xs) / len(xs)


def median(xs):
    if not xs:
        raise ValueError("median of an empty list")
    s = sorted(xs)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2
