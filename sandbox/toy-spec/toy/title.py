"""slug_title: slugify, then capitalise each "-"-separated part."""

from ..toy.slugify import slugify


def slug_title(s: str) -> str:
    return "-".join(part.capitalize() for part in slugify(s).split("-"))
