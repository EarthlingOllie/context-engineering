<?php

use App\Drivers\HttpUrlFetcher;
use App\Services\Ingestion\ExtractionFailed;
use Illuminate\Support\Facades\Http;

it('returns the raw html of a web page', function () {
    Http::fake(['example.com/*' => Http::response('<html><body>Hello</body></html>')]);

    expect((new HttpUrlFetcher)->fetch('https://example.com/faq'))->toBe('<html><body>Hello</body></html>');
});

it('explains in plain words when the page cannot be opened', function () {
    Http::fake(['example.com/*' => Http::response('Not found', 404)]);

    (new HttpUrlFetcher)->fetch('https://example.com/missing');
})->throws(ExtractionFailed::class, "We couldn't open that web page");

it('is an ordinary exception with a plain message', function () {
    $failure = new ExtractionFailed('We could not read that file.');

    expect($failure)->toBeInstanceOf(RuntimeException::class)
        ->and($failure->getMessage())->toBe('We could not read that file.');
});

it('explains in plain words when the page comes back empty', function () {
    Http::fake(['example.com/*' => Http::response('')]);

    (new HttpUrlFetcher)->fetch('https://example.com/blank');
})->throws(ExtractionFailed::class, "We couldn't open that web page");

it('explains in plain words when the site cannot be reached', function () {
    Http::fake(['example.com/*' => Http::failedConnection()]);

    (new HttpUrlFetcher)->fetch('https://example.com/down');
})->throws(ExtractionFailed::class, "We couldn't open that web page");
