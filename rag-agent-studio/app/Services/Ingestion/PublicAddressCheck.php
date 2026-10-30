<?php

namespace App\Services\Ingestion;

use Closure;

/**
 * Decides whether a web address points at the public internet rather than at
 * this machine or the private network, so "Add web page" cannot be used to
 * read internal services.
 */
class PublicAddressCheck
{
    /** @param  (Closure(string): list<string>)|null  $resolver  Returns the IPv4 addresses a host name resolves to. */
    public function __construct(private ?Closure $resolver = null) {}

    /** Whether the address could be a public web page, judged from the address alone (no lookup). */
    public function looksPublic(string $url): bool
    {
        $host = $this->host($url);

        if ($host === '') {
            return false;
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return $this->isPublicAddress($host);
        }

        if ($host === 'localhost' || ! str_contains($host, '.')) {
            return false;
        }

        foreach (['.localhost', '.local', '.internal'] as $suffix) {
            if (str_ends_with($host, $suffix)) {
                return false;
            }
        }

        return true;
    }

    /** The public address to connect to, or null when the address is not public (looked up when it is a name). */
    public function resolvePublic(string $url): ?string
    {
        if (! $this->looksPublic($url)) {
            return null;
        }

        $host = $this->host($url);

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return $host;
        }

        $resolver = $this->resolver ?? fn (string $host): array => gethostbynamel($host) ?: [];
        $addresses = $resolver($host);

        foreach ($addresses as $address) {
            if (! $this->isPublicAddress($address)) {
                return null;
            }
        }

        return $addresses[0] ?? null;
    }

    public function host(string $url): string
    {
        return trim(strtolower((string) parse_url($url, PHP_URL_HOST)), '[]');
    }

    private function isPublicAddress(string $address): bool
    {
        return filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }
}
