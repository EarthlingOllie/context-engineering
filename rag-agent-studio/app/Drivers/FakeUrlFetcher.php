<?php

namespace App\Drivers;

use App\Contracts\UrlFetcher;

class FakeUrlFetcher implements UrlFetcher
{
    public function fetch(string $url): string
    {
        return "<html><body><p>Fake page content for {$url}.</p></body></html>";
    }
}
