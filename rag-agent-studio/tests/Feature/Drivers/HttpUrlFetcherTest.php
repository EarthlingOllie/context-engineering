<?php

use App\Contracts\UrlFetcher;
use App\Drivers\HttpUrlFetcher;
use App\Services\Ingestion\ExtractionFailed;
use App\Services\Ingestion\PublicAddressCheck;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

function fetcher(int $maxBytes = 1024 * 1024): HttpUrlFetcher
{
    return new HttpUrlFetcher(new PublicAddressCheck(fn (string $host): array => ['93.184.216.34']), $maxBytes);
}

it('returns the raw html of a web page', function () {
    Http::fake(['example.com/*' => Http::response('<html><body>Hello</body></html>')]);

    expect(fetcher()->fetch('https://example.com/faq'))->toBe('<html><body>Hello</body></html>');
});

it('explains in plain words when the page cannot be opened', function () {
    Http::fake(['example.com/*' => Http::response('Not found', 404)]);

    fetcher()->fetch('https://example.com/missing');
})->throws(ExtractionFailed::class, "We couldn't open that web page");

it('is an ordinary exception with a plain message', function () {
    $failure = new ExtractionFailed('We could not read that file.');

    expect($failure)->toBeInstanceOf(RuntimeException::class)
        ->and($failure->getMessage())->toBe('We could not read that file.');
});

it('explains in plain words when the page comes back empty', function () {
    Http::fake(['example.com/*' => Http::response('')]);

    fetcher()->fetch('https://example.com/blank');
})->throws(ExtractionFailed::class, "We couldn't open that web page");

it('explains in plain words when the site cannot be reached', function () {
    Http::fake(['example.com/*' => Http::failedConnection()]);

    fetcher()->fetch('https://example.com/down');
})->throws(ExtractionFailed::class, "We couldn't open that web page");

it('refuses to open addresses inside the network without sending anything', function (string $url) {
    Http::fake();

    try {
        fetcher()->fetch($url);
        $this->fail('Expected the fetch to be refused');
    } catch (ExtractionFailed $failure) {
        expect($failure->getMessage())->toBe("That web address isn't a public web page");
    }

    Http::assertNothingSent();
})->with(['http://127.0.0.1:6379/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://intranet/']);

it('refuses a public host name that secretly resolves inside the network', function () {
    Http::fake();

    try {
        (new HttpUrlFetcher(new PublicAddressCheck(fn () => ['10.0.0.8'])))->fetch('https://example.com/');
        $this->fail('Expected the fetch to be refused');
    } catch (ExtractionFailed $failure) {
        expect($failure->getMessage())->toBe("That web address isn't a public web page");
    }

    Http::assertNothingSent();
});

it('follows a redirect to another public page', function () {
    Http::fake([
        'example.com/old' => Http::response('', 301, ['Location' => 'https://example.com/new']),
        'example.com/new' => Http::response('<html>New</html>'),
    ]);

    expect(fetcher()->fetch('https://example.com/old'))->toBe('<html>New</html>');
});

it('follows a redirect given as a path on the same site', function () {
    Http::fake([
        'example.com:8443/old' => Http::response('', 302, ['Location' => '/new?x=1']),
        'example.com:8443/new?x=1' => Http::response('<html>New</html>'),
    ]);

    expect(fetcher()->fetch('https://example.com:8443/old'))->toBe('<html>New</html>');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://example.com:8443/new?x=1');
});

it('checks every redirect hop, so a public page cannot bounce it inside the network', function (string $location) {
    Http::fake([
        'example.com/old' => Http::response('', 302, ['Location' => $location]),
    ]);

    try {
        fetcher()->fetch('https://example.com/old');
        $this->fail('Expected the redirect to be refused');
    } catch (ExtractionFailed $failure) {
        expect($failure->getMessage())->toBe("That web address isn't a public web page");
    }

    Http::assertSentCount(1);
})->with(['http://127.0.0.1/', 'http://169.254.169.254/latest/', 'http://[::1]:6379/']);

it('gives up on a redirect it cannot make sense of', function (string $location) {
    Http::fake(['example.com/old' => Http::response('', 302, ['Location' => $location])]);

    fetcher()->fetch('https://example.com/old');
})->with(['no location' => '', 'relative path' => 'next-page.html', 'not http' => 'ftp://example.com/x'])
    ->throws(ExtractionFailed::class, "We couldn't open that web page");

it('stops following redirects after five hops', function () {
    Http::fake(['example.com/*' => Http::response('', 302, ['Location' => 'https://example.com/again'])]);

    try {
        fetcher()->fetch('https://example.com/start');
        $this->fail('Expected the fetch to give up');
    } catch (ExtractionFailed $failure) {
        expect($failure->getMessage())->toBe("We couldn't open that web page");
    }

    Http::assertSentCount(6);
});

it('refuses pages bigger than the limit', function () {
    Http::fake(['example.com/*' => Http::response(str_repeat('a', 1001))]);

    fetcher(maxBytes: 1000)->fetch('https://example.com/huge');
})->throws(ExtractionFailed::class, 'That web page is too big to read');

it('reads pages up to the limit', function () {
    Http::fake(['example.com/*' => Http::response(str_repeat('a', 1000))]);

    expect(strlen(fetcher(maxBytes: 1000)->fetch('https://example.com/big')))->toBe(1000);
});

it('is built with a real address check and a sensible page limit', function () {
    config(['studio.url_fetch_driver' => 'real']);

    $fetcher = app(UrlFetcher::class);

    expect($fetcher)->toBeInstanceOf(HttpUrlFetcher::class)
        ->and((fn () => $this->maxBytes)->call($fetcher))->toBe(5 * 1024 * 1024);
});
