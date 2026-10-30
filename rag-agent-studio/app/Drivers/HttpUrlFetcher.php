<?php

namespace App\Drivers;

use App\Contracts\UrlFetcher;
use App\Services\Ingestion\ExtractionFailed;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class HttpUrlFetcher implements UrlFetcher
{
    public function fetch(string $url): string
    {
        try {
            $response = Http::timeout(15)->get($url);
        } catch (ConnectionException) {
            throw new ExtractionFailed("We couldn't open that web page");
        }

        if (! $response->successful() || trim($response->body()) === '') {
            throw new ExtractionFailed("We couldn't open that web page");
        }

        return $response->body();
    }
}
