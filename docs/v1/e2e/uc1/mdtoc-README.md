# mdtoc

Generates or refreshes a table of contents inside a Markdown file, in place. Node only, no dependencies.

## Usage

    node mdtoc.js <file.md>

The single argument is the file to update; it is rewritten only when its content changes. Exit codes: `0` on success, `1` if the file cannot be read or a marker is missing, `2` with a usage message on stderr if no file is given.

## Markers

Put these two HTML comments where the TOC should live:

    <!-- toc -->
    <!-- /toc -->

Everything between them is replaced with the generated list, with one newline on each side (with no headings, the markers end up on adjacent lines). Lines consisting only of a marker are ignored when scanning for headings, so a stale TOC never feeds itself. Both markers are required and the end marker must come after the start marker; otherwise the tool prints `mdtoc: missing <marker> marker` and exits `1`.

## What counts as a heading

- ATX headings only: `#` to `######` followed by at least one space or tab, with up to 3 leading spaces. Trailing closing hashes are dropped.
- Headings inside fenced code blocks (``` or ~~~) are skipped.
- Inline Markdown is stripped from the displayed text: links and images keep their text, backtick code and `*`/`_` emphasis keep their content.
- Indentation is two spaces per level relative to the shallowest heading in the file, so a document whose first heading is `##` starts flush left. Skipped levels (`##` straight to `####`) produce the matching gap.

## Heading-to-anchor rules

Anchors follow GitHub's scheme: trim, lowercase, drop every character that is not a letter, number, whitespace, `_` or `-`, then collapse whitespace runs to a single `-`. Duplicate anchors get `-1`, `-2`, ... appended in document order. For example the heading `### Usage: The `Basics`` becomes `#usage-the-basics`, and a second `Getting Started` becomes `#getting-started-1`.

## Example

Given `guide.md` containing:

    # Guide

    <!-- toc -->
    <!-- /toc -->

    ## Getting Started
    ### Usage: The `Basics`
    ## Getting Started

after `node mdtoc.js guide.md` the marker block reads:

    <!-- toc -->
    - [Guide](#guide)
      - [Getting Started](#getting-started)
        - [Usage: The Basics](#usage-the-basics)
      - [Getting Started](#getting-started-1)
    <!-- /toc -->

The rest of the file is unchanged. Running the tool again on its own output is a no-op: the content is byte-identical and the file is not touched. `sample.md` in this directory is a larger example whose TOC is already current, and the CLI test runs the tool twice on a copy of it to verify this.

## Running the tests

    node --test test/mdtoc.test.js

Tests use `node:test` and `node:assert/strict` (Node 22), so no install step is needed. They cover TOC insertion and refresh, anchor generation, fence and marker-block skipping, inline-markdown stripping, missing-marker errors, CLI idempotency and the usage exit code.
