# Feature: parse_duration

Retry and timeout settings are written as short duration strings such as `90s`,
`5m` or `1h30m`. Add `parse_duration(text: str) -> int` to
`retrykit/duration.py`, returning the duration in whole seconds.

## Rules

1. A duration is one or more components. A component is a whole number of
   digits followed by one unit: `d` (86400 s), `h` (3600 s), `m` (60 s) or
   `s` (1 s). The result is the sum of the components.
2. Units are case-insensitive: `1H30M` equals `1h30m`.
3. Whitespace before or after the duration is ignored. Whitespace inside it
   (`1h 30m`) is not allowed.
4. Components appear in descending unit order (`d`, then `h`, then `m`, then
   `s`), and each unit at most once: `30m1h` and `1m2m` are invalid.
5. A zero component is allowed: `0s` is 0 and `1h0m` is 3600.
6. Invalid input raises `ValueError`. That includes the empty string, a
   string of only whitespace, a number with no unit (`90`), a unit with no
   number (`h`), an unknown unit (`5w`), a sign (`-5s`, `+5s`), a decimal
   (`1.5h`) and anything else rule 1 does not allow.
7. Input that is not a `str` raises `TypeError`.

`tests/test_duration.py` covers rule 1 only. Add tests for the other rules
alongside it.
