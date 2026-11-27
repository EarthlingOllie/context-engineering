import re

_TOKEN = re.compile(r"\s*(?:(\d+(?:\.\d+)?)|(.))")


def parse_expression(text):
    """Evaluate a left-to-right expression of numbers and + - * / (no precedence)."""
    tokens = [(num, op) for num, op in _TOKEN.findall(text) if num or op.strip()]
    if not tokens or not tokens[0][0]:
        raise ValueError(f"expected a number at the start of {text!r}")
    value = float(tokens[0][0])
    i = 1
    while i < len(tokens):
        op = tokens[i][1]
        if i + 1 >= len(tokens) or not tokens[i + 1][0]:
            raise ValueError(f"expected a number after {op!r}")
        rhs = float(tokens[i + 1][0])
        value = {"+": value + rhs, "-": value - rhs, "*": value * rhs, "/": value / rhs}[op]
        i += 2
    return value
