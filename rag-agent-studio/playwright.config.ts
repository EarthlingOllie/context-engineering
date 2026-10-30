import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The browser journeys run against a throwaway copy of the app configured by
// .env.e2e: a dedicated SQLite file (migrated fresh in global-setup.ts), the
// pretend answer/embedding/web-page services, no background workers and
// emails written to storage/e2e/laravel.log. Nothing touches the network.
//
// The port is deliberately not 8000, so the journeys can run while the usual
// `php artisan serve` dev server is up. Change it here only; APP_URL follows.
const port = 8010;
const baseURL = `http://127.0.0.1:${port}`;

// Set PW_CHROMIUM to use a Chromium outside Playwright's own browser folder.
const chromium = process.env.PW_CHROMIUM;

export default defineConfig({
    testDir: './e2e',
    globalSetup: './e2e/global-setup.ts',
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        permissions: ['clipboard-read', 'clipboard-write'],
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: chromium ? { executablePath: chromium } : {},
            },
        },
    ],
    webServer: {
        command: `php artisan serve --env=e2e --no-reload --host=127.0.0.1 --port=${port}`,
        url: `${baseURL}/login`,
        reuseExistingServer: false,
        timeout: 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
        env: {
            APP_URL: baseURL,
            // Adds e2e/php.d (upload size limits) on top of PHP's usual ini folders.
            PHP_INI_SCAN_DIR: `${process.env.PHP_INI_SCAN_DIR ?? ''}:${path.resolve(here, 'e2e/php.d')}`,
        },
    },
});
