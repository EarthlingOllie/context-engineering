<?php

use App\Enums\AgentStatus;
use App\Models\Agent;
use App\Models\EmbedKey;
use App\Models\Source;
use App\Services\AgentPublisher;
use App\Services\CannotPublish;

it('takes a draft live and issues a share key', function () {
    $agent = Agent::factory()->create();
    Source::factory()->ready()->for($agent)->create();

    app(AgentPublisher::class)->publish($agent);

    $agent->refresh();
    expect($agent->status)->toBe(AgentStatus::Published)
        ->and($agent->published_at)->not->toBeNull()
        ->and($agent->embedKey)->not->toBeNull()
        ->and($agent->embedKey->organisation_id)->toBe($agent->organisation_id)
        ->and(strlen($agent->embedKey->public_key))->toBe(32);
});

it('keeps the existing share key when going live again', function () {
    $agent = Agent::factory()->unpublished()->create();
    Source::factory()->ready()->for($agent)->create();
    $key = EmbedKey::factory()->for($agent)->create();

    app(AgentPublisher::class)->publish($agent);

    expect($agent->refresh()->status)->toBe(AgentStatus::Published)
        ->and($agent->embedKeys()->count())->toBe(1)
        ->and($agent->embedKey->id)->toBe($key->id);
});

it('issues a fresh key when the old one was revoked', function () {
    $agent = Agent::factory()->unpublished()->create();
    Source::factory()->ready()->for($agent)->create();
    EmbedKey::factory()->revoked()->for($agent)->create();

    app(AgentPublisher::class)->publish($agent);

    expect($agent->embedKeys()->count())->toBe(2)
        ->and($agent->refresh()->embedKey)->not->toBeNull();
});

it('refuses to publish without a ready source', function (?string $state) {
    $agent = Agent::factory()->create();
    if ($state) {
        Source::factory()->{$state}()->for($agent)->create();
    }

    expect(fn () => app(AgentPublisher::class)->publish($agent))
        ->toThrow(CannotPublish::class, 'Add at least one ready source');
    expect($agent->refresh()->status)->toBe(AgentStatus::Draft)
        ->and($agent->embedKeys()->count())->toBe(0);
})->with(['no sources' => null, 'a waiting source' => 'processing', 'a failed source' => 'failed']);

it('takes a live assistant offline but keeps its key for later', function () {
    $agent = Agent::factory()->published()->create();
    $key = EmbedKey::factory()->for($agent)->create();

    app(AgentPublisher::class)->unpublish($agent);

    expect($agent->refresh()->status)->toBe(AgentStatus::Unpublished)
        ->and($agent->embedKey->id)->toBe($key->id);
});

it('resets the share link by revoking the old key and issuing a new one', function () {
    $agent = Agent::factory()->published()->create();
    $old = EmbedKey::factory()->for($agent)->create();

    $new = app(AgentPublisher::class)->resetKey($agent);

    expect($new)->toBeInstanceOf(EmbedKey::class)
        ->and($new->public_key)->not->toBe($old->public_key)
        ->and($new->agent_id)->toBe($agent->id)
        ->and($old->refresh()->isActive())->toBeFalse()
        ->and($agent->refresh()->embedKey->id)->toBe($new->id);
});

it('can reset the link even if no key existed yet', function () {
    $agent = Agent::factory()->create();

    $new = app(AgentPublisher::class)->resetKey($agent);

    expect($agent->embedKeys()->count())->toBe(1)
        ->and($agent->refresh()->embedKey->id)->toBe($new->id);
});

it('explains why publishing failed in plain words', function () {
    $failure = new CannotPublish;

    expect($failure)->toBeInstanceOf(RuntimeException::class)
        ->and($failure->getMessage())->toBe('Add at least one ready source');
});
