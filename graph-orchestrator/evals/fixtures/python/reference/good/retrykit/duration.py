import re

_UNITS = {"d": 86400, "h": 3600, "m": 60, "s": 1}
_FORM = re.compile(r"(?:([0-9]+)d)?(?:([0-9]+)h)?(?:([0-9]+)m)?(?:([0-9]+)s)?", re.ASCII)


def parse_duration(text: str) -> int:
    if not isinstance(text, str):
        raise TypeError("duration must be a str")
    s = text.strip().lower()
    m = _FORM.fullmatch(s)
    if not s or not m or not any(m.groups()):
        raise ValueError(f"invalid duration: {text!r}")
    return sum(int(n) * mult for n, mult in zip(m.groups(), _UNITS.values()) if n is not None)
