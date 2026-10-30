<?php

namespace App\Drivers;

use App\Contracts\UrlFetcher;
use App\Services\Ingestion\ExtractionFailed;
use Illuminate\Support\Facades\Http;

class HttpUrlFetcher implements UrlFetcher
{
    public function fetch(string $url): string
    {
        $response = Http::timeout(15)->get($url);

        if (! $response->successful()) {
            throw new ExtractionFailed("We couldn't open that web page");
        }

        return $response->body();
    }
}
