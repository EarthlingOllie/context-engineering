---
name: release-note
description: Write a release-note line for a code change described by the user.
---
Write a one-line release note for the code change the user describes. The note is for end users of the product, not for developers.

Input: a short, often technical description of a code change. It may name implementation details such as functions, classes, files, exceptions, database indexes, tables, columns, cookies, tokens, libraries, tools, version numbers or ticket IDs (e.g. "JIRA-4411"). It may also state the user-facing effect, such as "order history page loads 6x faster".

Output: exactly one line, with nothing before or after it. That means no header like "Release note:", no quotes, no blockquote, no bold, no markdown, no alternative versions, and no explanation.

Format of the line:
[Tag] Past-tense description of the user-facing change

Rules:
1. One line only. Never output several sentences, paragraphs or options.
2. Start with exactly one tag in square brackets, followed by a space. Do not use bold labels like "**New:**".
   - [Feature]: new capabilities, buttons, exports or options.
   - [Perf]: speed or efficiency improvements.
   - [Fix]: bug fixes, crashes and errors.
   - [Chore]: internal maintenance with no direct user-visible effect, such as dependency or tooling upgrades, linting, build or config changes, and refactors.
   - For anything else, use a short bracketed tag in the same style.
3. Start the description with a past-tense verb, such as "Added", "Made", "Fixed", "Improved", "Updated" or "Removed". Do not use present tense ("now loads") or second person ("you").
4. Write for end users, not developers. This is the rule most often broken, so apply it strictly:
   - Leave out all implementation details: function, method, class and file names, exception types (e.g. NullPointerException), database objects, ticket numbers, code formatting and backticks.
   - Leave out internal causes and mechanisms too, even when they sound harmless. Cookies, tokens, sessions-as-data, caches, configs, APIs and services are internals. Say what the user was doing and what went wrong for them, not what the code was missing. Example: "when the session cookie was missing" becomes "when signing in without an active session".
   - Be specific about the symptom the user saw. Don't write a vague "an error" or "an issue". If the input mentions an unhandled exception or a NullPointerException, the user most likely saw a crash, so write "a crash".
   - For developer-only changes such as upgrading a linter, build tool, test framework or library, or changing config formats, do not name the tool, the version or the config format. Use generic plain language, e.g. "[Chore] Updated developer linting tools" or "[Chore] Updated internal build tooling".
   - If the input gives a measurable user benefit such as "6x faster", keep it, and soften it with "about" where that fits.
5. Keep the whole line, tag included, at 90 characters or fewer. Be concise.
6. Do not end the line with a period or any other trailing punctuation.
7. Use plain lowercase for page and feature names unless they are proper nouns, e.g. "the reports page".

Approach: (a) Work out what a non-technical user would actually notice: a new capability, faster speed, a crash or wrong behavior that no longer happens, or nothing at all (a chore). (b) Pick the tag. (c) Write one past-tense clause that describes the user's situation and the effect. (d) Remove every technical term, including internal causes, tool names and versions. Ask yourself whether a non-developer customer would understand every word. (e) Check that the line is 90 characters or fewer and has no trailing period.

Examples:
Input: Added a composite index on orders(customer_id, created_at); order history page loads 6x faster
Output: [Perf] Made the order history page load about 6x faster

Input: Added CSV export button to the reports page, implemented in ReportExporter.toCsv
Output: [Feature] Added CSV export to the reports page

Input: Fixed a NullPointerException in AuthService.validateToken when the session cookie was missing (JIRA-4411)
Output: [Fix] Fixed a crash when signing in without an active session

Input: Bumped eslint from 8.57 to 9.2 and updated .eslintrc to flat config
Output: [Chore] Updated developer linting tools