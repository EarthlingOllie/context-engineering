<?php

namespace App\Drivers;

use App\Contracts\UrlFetcher;
use App\Services\Ingestion\ExtractionFailed;
use App\Services\Ingestion\PublicAddressCheck;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class HttpUrlFetcher implements UrlFetcher
{
    private const MAX_REDIRECTS = 5;

    public function __construct(
        private PublicAddressCheck $addresses,
        private int $maxBytes = 5 * 1024 * 1024,
    ) {}

    public function fetch(string $url): string
    {
        // Redirects are followed by hand so every hop gets the same public-address check
        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            $response = $this->get($url);

            if ($response->redirect()) {
                $url = $this->redirectTarget($url, $response->header('Location'));

                continue;
            }

            if (! $response->successful() || trim($response->body()) === '') {
                throw new ExtractionFailed("We couldn't open that web page");
            }

            if (strlen($response->body()) > $this->maxBytes) {
                throw new ExtractionFailed('That web page is too big to read');
            }

            return $response->body();
        }

        throw new ExtractionFailed("We couldn't open that web page");
    }

    private function get(string $url): Response
    {
        $address = $this->addresses->resolvePublic($url);

        if ($address === null) {
            throw new ExtractionFailed("That web address isn't a public web page");
        }

        $host = $this->addresses->host($url);
        $port = parse_url($url, PHP_URL_PORT) ?? (parse_url($url, PHP_URL_SCHEME) === 'https' ? 443 : 80);

        try {
            return Http::timeout(15)
                ->withoutRedirecting()
                // Connect to the address that was checked, even if the name resolves differently a moment later
                ->withOptions(['curl' => [CURLOPT_RESOLVE => ["{$host}:{$port}:{$address}"]]])
                ->get($url);
        } catch (ConnectionException) {
            throw new ExtractionFailed("We couldn't open that web page");
        }
    }

    /** Turns a Location header into the full address to try next; only http(s) and site-relative paths are accepted. */
    private function redirectTarget(string $from, string $location): string
    {
        if (str_starts_with($location, '/')) {
            $parts = parse_url($from);
            $origin = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');

            return $origin.$location;
        }

        if (! in_array(parse_url($location, PHP_URL_SCHEME), ['http', 'https'], true)) {
            throw new ExtractionFailed("We couldn't open that web page");
        }

        return $location;
    }
}
