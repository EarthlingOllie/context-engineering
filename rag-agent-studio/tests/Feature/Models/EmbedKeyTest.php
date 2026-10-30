<?php

use App\Models\Agent;
use App\Models\EmbedKey;

it('generates a 32 character url-safe key that is active until revoked', function () {
    $agent = Agent::factory()->create();

    $key = EmbedKey::create([
        'organisation_id' => $agent->organisation_id,
        'agent_id' => $agent->id,
    ]);

    expect($key->public_key)->toMatch('/^[A-Za-z0-9]{32}$/')
        ->and($key->revoked_at)->toBeNull()
        ->and($key->isActive())->toBeTrue()
        ->and($key->agent->is($agent))->toBeTrue()
        ->and($key->organisation->is($agent->organisation))->toBeTrue();
});

it('keeps an explicit key and is inactive once revoked', function () {
    $key = EmbedKey::factory()->revoked()->create(['public_key' => str_repeat('k', 32)]);

    expect($key->public_key)->toBe(str_repeat('k', 32))
        ->and($key->revoked_at)->not->toBeNull()
        ->and($key->isActive())->toBeFalse();
});

it('finds the active key by its public value', function () {
    $revoked = EmbedKey::factory()->revoked()->create();
    $active = EmbedKey::factory()->create();

    expect(EmbedKey::active()->pluck('id')->all())->toBe([$active->id])
        ->and(EmbedKey::active()->where('public_key', $revoked->public_key)->exists())->toBeFalse();
});
