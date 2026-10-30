<?php

use App\Enums\AgentStatus;
use App\Enums\Tone;
use App\Models\Agent;
use App\Models\Chunk;
use App\Models\Conversation;
use App\Models\EmbedKey;
use App\Models\Project;
use App\Models\Source;

it('starts as a draft with the default colour', function () {
    $project = Project::factory()->create();

    $agent = Agent::create([
        'organisation_id' => $project->organisation_id,
        'project_id' => $project->id,
        'name' => 'Helper',
        'greeting' => 'Hi there',
        'tone' => Tone::Friendly,
        'instructions' => 'Help with orders',
        'fallback_message' => "Sorry, I don't know.",
    ]);

    expect($agent->status)->toBe(AgentStatus::Draft)
        ->and($agent->accent_colour)->toBe('#2563eb')
        ->and($agent->published_at)->toBeNull()
        ->and($agent->tone)->toBe(Tone::Friendly)
        ->and($agent->isLive())->toBeFalse()
        ->and($agent->project->is($project))->toBeTrue()
        ->and($agent->organisation->is($project->organisation))->toBeTrue();
});

it('knows when it is live', function () {
    $agent = Agent::factory()->published()->create();

    expect($agent->status)->toBe(AgentStatus::Published)
        ->and($agent->published_at)->not->toBeNull()
        ->and($agent->isLive())->toBeTrue();
});

it('can be taken offline', function () {
    $agent = Agent::factory()->unpublished()->create();

    expect($agent->status)->toBe(AgentStatus::Unpublished)
        ->and($agent->isLive())->toBeFalse();
});

it('owns its sources, chunks, conversations and share key', function () {
    $agent = Agent::factory()->create();
    $source = Source::factory()->for($agent)->create();
    $chunk = Chunk::factory()->for($source)->create();
    $conversation = Conversation::factory()->for($agent)->create();
    $revoked = EmbedKey::factory()->for($agent)->revoked()->create();
    $active = EmbedKey::factory()->for($agent)->create();

    expect($agent->sources->pluck('id')->all())->toBe([$source->id])
        ->and($agent->chunks->pluck('id')->all())->toBe([$chunk->id])
        ->and($agent->conversations->pluck('id')->all())->toBe([$conversation->id])
        ->and($agent->embedKeys->pluck('id')->all())->toBe([$revoked->id, $active->id])
        ->and($agent->embedKey->is($active))->toBeTrue();
});

it('knows whether it has any ready knowledge', function () {
    $agent = Agent::factory()->create();
    Source::factory()->for($agent)->create();

    expect($agent->hasReadySource())->toBeFalse();

    Source::factory()->for($agent)->ready()->create();

    expect($agent->fresh()->hasReadySource())->toBeTrue();
});

it('removes everything it owns when deleted', function () {
    $agent = Agent::factory()->create();
    $source = Source::factory()->for($agent)->create();
    Chunk::factory()->for($source)->create();
    Conversation::factory()->for($agent)->create();
    EmbedKey::factory()->for($agent)->create();

    $agent->delete();

    expect(Source::count())->toBe(0)
        ->and(Chunk::count())->toBe(0)
        ->and(Conversation::count())->toBe(0)
        ->and(EmbedKey::count())->toBe(0);
});
