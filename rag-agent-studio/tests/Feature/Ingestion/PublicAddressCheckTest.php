<?php

use App\Services\Ingestion\PublicAddressCheck;

function checkResolvingTo(array $addresses): PublicAddressCheck
{
    return new PublicAddressCheck(fn (string $host): array => $addresses);
}

it('accepts an ordinary public web address at a glance', function (string $url) {
    expect((new PublicAddressCheck)->looksPublic($url))->toBeTrue();
})->with([
    'https://example.com/faq',
    'http://www.example.co.uk:8080/help?x=1',
    'https://93.184.216.34/',
    'https://[2606:2800:220:1:248:1893:25c8:1946]/',
]);

it('rejects addresses that point inside the network or at this machine', function (string $url) {
    expect((new PublicAddressCheck)->looksPublic($url))->toBeFalse()
        ->and((new PublicAddressCheck)->resolvePublic($url))->toBeNull();
})->with([
    'loopback' => 'http://127.0.0.1/admin',
    'loopback range' => 'http://127.10.0.3/',
    'localhost' => 'http://localhost:6379/',
    'localhost subdomain' => 'http://db.localhost/',
    'cloud metadata' => 'http://169.254.169.254/latest/meta-data/',
    'private 10/8' => 'http://10.0.0.5/',
    'private 172.16/12' => 'http://172.31.255.1/',
    'private 192.168/16' => 'http://192.168.1.1/',
    'this network' => 'http://0.0.0.0/',
    'ipv6 loopback' => 'http://[::1]/',
    'ipv6 unique local' => 'http://[fd00::1]/',
    'single label host' => 'http://intranet/',
    '.local' => 'http://printer.local/',
    '.internal' => 'http://vault.internal/',
    'no host' => 'http:///path',
]);

it('resolves a public host name to its address', function () {
    expect(checkResolvingTo(['93.184.216.34'])->resolvePublic('https://example.com/faq'))->toBe('93.184.216.34');
});

it('hands back a public address literal without looking it up', function () {
    expect((new PublicAddressCheck(fn () => throw new LogicException('should not resolve')))->resolvePublic('https://93.184.216.34/'))
        ->toBe('93.184.216.34');
});

it('rejects a public-looking host name that resolves inside the network', function (array $addresses) {
    expect(checkResolvingTo($addresses)->resolvePublic('https://example.com/'))->toBeNull();
})->with([
    'loopback' => [['127.0.0.1']],
    'private' => [['10.1.2.3']],
    'mixed public and private' => [['93.184.216.34', '192.168.0.1']],
    'metadata' => [['169.254.169.254']],
    'unresolvable' => [[]],
]);

it('looks host names up for real when no resolver is given', function () {
    expect((new PublicAddressCheck)->resolvePublic('http://localhost.localdomain/'))->toBeNull();
});
