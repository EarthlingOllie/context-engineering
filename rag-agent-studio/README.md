# Assistant Studio

Assistant Studio lets a team build a chat assistant that answers questions from
their own material (files, pasted text and web pages), try it out, and then put
it on their website or share it with a link. Nobody needs to write code or know
how the assistant works inside.

## What you can do

1. **Create a workspace** for your team and invite teammates by email.
2. **Create a project** and, inside it, one or more **assistants**.
3. **Set up** each assistant: its name, greeting, tone, what it helps with,
   what it says when it does not know, and its colour.
4. **Add knowledge**: upload PDF, Word, text or Markdown files, paste text, or
   add a web address. Each source goes from *Waiting* to *Reading* to *Ready*.
5. **Test** the assistant in a private chat. Every reply says which sources it
   was based on.
6. **Publish** it. You get a **share link** (a hosted chat page) and a one-line
   **website snippet** that adds a floating chat button to any site. You can
   take the assistant offline or reset the link at any time.

## Setup

Requirements: PHP 8.2+ with the `sqlite3`, `pdo_sqlite`, `mbstring`, `dom`,
`fileinfo` and `zip` extensions, Composer, Node.js 20+ and npm.

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm run build
php artisan serve
```

Then open <http://127.0.0.1:8000>, create a workspace and follow the steps
above. Out of the box the app uses built-in stand-in services for answers and
knowledge processing, so everything works without any accounts or API keys;
see **Connecting real providers** below to get real answers.

Out of the box, knowledge sources are read as soon as they are added
(`QUEUE_CONNECTION=sync` in `.env`). For a busier installation, set
`QUEUE_CONNECTION=database` and keep a background worker running, otherwise
every source stays at *Waiting*:

```bash
php artisan queue:work
```

**Uploads over 2 MB.** `php artisan serve` uses PHP's default upload limit of
2 MB, so a larger PDF is refused by PHP before the app can say anything. To
allow the 10 MB the app is designed for, set `upload_max_filesize = 12M` and
`post_max_size = 16M` in your `php.ini` (or point `PHP_INI_SCAN_DIR` at a folder
containing `e2e/php.d/uploads.ini`, which sets exactly that).

**Invitation emails.** The default `MAIL_MAILER=log` writes emails to
`storage/logs/laravel.log` instead of sending them. The Team page also shows
each pending invitation's link with a Copy button, so the owner can send it by
hand until real mail settings are in place.

**Web pages.** "Add web page" only accepts public addresses: anything pointing
at this machine or the private network (`localhost`, `127.0.0.1`,
`10.x`, `192.168.x`, `169.254.x`, …) is refused, each redirect is checked
again, and pages over 5 MB are not read.

## Connecting real providers

Set these in `.env`:

| Variable | Values | What it does |
|---|---|---|
| `STUDIO_ANSWER_DRIVER` | `fake` (default) or `real` | Who writes the replies. `real` uses Anthropic's Claude. |
| `STUDIO_EMBEDDING_DRIVER` | `fake` (default) or `real` | How knowledge is indexed for search. `real` uses Voyage AI. |
| `STUDIO_URL_FETCH_DRIVER` | `fake` (default) or `real` | Whether "Add web page" really downloads the page. |
| `ANTHROPIC_API_KEY` | your key | Needed when `STUDIO_ANSWER_DRIVER=real`. |
| `VOYAGE_API_KEY` | your key | Needed when `STUDIO_EMBEDDING_DRIVER=real`. |
| `STUDIO_ANSWER_MODEL` | optional | Overrides the Claude model (default `claude-sonnet-4-5`). |
| `STUDIO_EMBEDDING_MODEL` | optional | Overrides the Voyage model (default `voyage-3`). |
| `APP_URL` | your public address | Used in the share link, the website snippet and invitation emails. |
| `MAIL_MAILER` and `MAIL_*` | your mail settings | Invitation emails. The default `log` mailer writes them to `storage/logs/laravel.log`. |

Processing settings (chunk size, how many sources are used per answer, the
10 MB upload limit, and so on) live in `config/studio.php`.

## Running the checks

```bash
bin/check
```

This runs, in order, and stops at the first failure:

1. `vendor/bin/pint --test` – code style.
2. `php artisan test --coverage --min=100` – the Pest suite; fails if any line
   of `app/` is not covered (needs the `pcov` PHP extension).
3. `npm run build` – the front-end build.
4. `npm run test:e2e` – the Playwright browser journeys in `e2e/`.

Each part can be run on its own with the same commands (step 4 needs step 3's
build to exist). GitHub Actions (`.github/workflows/tests.yml`) runs the same
`bin/check` on every push and pull request.

### How the browser journeys are set up

The Playwright journeys are hermetic. `playwright.config.ts` starts
`php artisan serve --env=e2e` on port 8010 (so it never collides with the
usual dev server on 8000), which reads `.env.e2e`: a throwaway SQLite file
(`database/e2e.sqlite`, recreated by `e2e/global-setup.ts` before every run),
sessions, cache, uploads and the log kept in that database and in
`storage/e2e/` (wiped before every run), the stand-in answer/embedding/web-page
services, no background queue (`QUEUE_CONNECTION=sync`) and the `log` mailer,
so the invitation link can be read back from `storage/e2e/laravel.log`.
Nothing on the network is touched. `e2e/php.d/uploads.ini` raises PHP's
upload limit for that server so the "file under 10 MB" message can be
exercised. Playwright uses its own Chromium (`npx playwright install chromium`);
set `PW_CHROMIUM=/path/to/chromium` to use another build. `.env.testing` and
`.env.e2e` carry throwaway keys of their own and are safe to commit; the real
`.env` is not tracked.

## Project layout

- `app/Livewire` – the screens (register, log in, projects, assistant tabs, team).
- `app/Http/Controllers` – the hosted chat page, the website snippet and the chat API.
- `app/Services/Ingestion` – reading files and web pages and splitting them up.
- `app/Services/Rag` – finding the relevant knowledge and writing an answer.
- `app/Drivers` – the real and stand-in answer, embedding and web-page services.
- `e2e/` – browser journeys, one file per journey.
- `tests/` – the Pest suite.
