<?php

namespace App\Contracts;

interface UrlFetcher
{
    /** Return the raw HTML of a web page. */
    public function fetch(string $url): string;
}
