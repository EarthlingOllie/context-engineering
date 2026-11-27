"""slugify: lowercase, collapse non-alphanumeric ASCII runs to "-", strip "-"."""

import re

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(s: str) -> str:
    return _NON_ALNUM.sub("-", s.lower()).strip("-")
