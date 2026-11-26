import re


def parse_duration(text):
    total = 0
    for n, unit in re.findall(r"(\d+)([dhms])", text):
        total += int(n) * {"d": 86400, "h": 3600, "m": 60, "s": 1}[unit]
    return total
