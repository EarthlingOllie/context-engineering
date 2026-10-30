<?php

// The checks that keep bin/check honest: secrets stay out of the repo, CI runs
// the whole gate, and the browser journeys cannot be silently narrowed.

function envValue(string $file, string $key): ?string
{
    preg_match('/^'.preg_quote($key, '/').'=(.*)$/m', file_get_contents(base_path($file)), $matches);

    return $matches[1] ?? null;
}

it('gives each committed environment file its own throwaway key', function () {
    $testing = envValue('.env.testing', 'APP_KEY');
    $e2e = envValue('.env.e2e', 'APP_KEY');

    expect($testing)->toStartWith('base64:')
        ->and($e2e)->toStartWith('base64:')
        ->and($testing)->not->toBe($e2e);

    if (file_exists(base_path('.env'))) {
        expect(envValue('.env', 'APP_KEY'))->not->toBeIn([$testing, $e2e]);
    }
});

it('runs the whole gate in CI with a coverage driver and a browser', function () {
    $workflow = file_get_contents(base_path('.github/workflows/tests.yml'));

    expect($workflow)->toContain('bin/check')
        ->toContain('coverage: pcov')
        ->toContain('playwright install --with-deps chromium')
        ->not->toContain('coverage: none')
        ->not->toMatch('/run: php artisan test\s*$/m');
});

it('fails the browser journeys when a test.only is left behind', function () {
    expect(file_get_contents(base_path('playwright.config.ts')))->toContain('forbidOnly: true');
});

it('does not pin the browser to one machine', function () {
    expect(file_get_contents(base_path('playwright.config.ts')))->not->toContain('/opt/pw-browsers');
});

it('runs the browser journeys on a port of their own', function () {
    $config = file_get_contents(base_path('playwright.config.ts'));

    expect($config)->not->toContain(':8000')
        ->and(envValue('.env.e2e', 'APP_URL'))->toBeNull();
});

it('fails the suite on skipped, incomplete or risky tests', function () {
    $phpunit = file_get_contents(base_path('phpunit.xml'));

    expect($phpunit)->toContain('failOnSkipped="true"')
        ->toContain('failOnIncomplete="true"')
        ->toContain('failOnRisky="true"');
});

it('starts a fresh install with knowledge read straight away', function () {
    expect(envValue('.env.example', 'QUEUE_CONNECTION'))->toBe('sync');
});
