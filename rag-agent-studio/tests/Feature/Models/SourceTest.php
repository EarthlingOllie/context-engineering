<?php

use App\Enums\SourceStatus;
use App\Enums\SourceType;
use App\Models\Agent;
use App\Models\Chunk;
use App\Models\Source;

it('starts waiting with no chunks', function () {
    $agent = Agent::factory()->create();

    $source = Source::create([
        'organisation_id' => $agent->organisation_id,
        'agent_id' => $agent->id,
        'type' => SourceType::Text,
        'title' => 'Opening hours',
        'raw_text' => 'We open at 9.',
    ]);

    expect($source->status)->toBe(SourceStatus::Pending)
        ->and($source->type)->toBe(SourceType::Text)
        ->and($source->chunk_count)->toBe(0)
        ->and($source->error_message)->toBeNull()
        ->and($source->agent->is($agent))->toBeTrue()
        ->and($source->organisation->is($agent->organisation))->toBeTrue();
});

it('has factory states for every kind of source and outcome', function () {
    $file = Source::factory()->file()->create();
    $url = Source::factory()->url()->create();
    $ready = Source::factory()->ready()->create();
    $failed = Source::factory()->failed()->create();
    $processing = Source::factory()->processing()->create();

    expect($file->type)->toBe(SourceType::File)
        ->and($file->path)->not->toBeNull()
        ->and($url->type)->toBe(SourceType::Url)
        ->and($url->url)->toStartWith('http')
        ->and($ready->status)->toBe(SourceStatus::Ready)
        ->and($ready->chunk_count)->toBeGreaterThan(0)
        ->and($failed->status)->toBe(SourceStatus::Failed)
        ->and($failed->error_message)->not->toBeNull()
        ->and($processing->status)->toBe(SourceStatus::Processing);
});

it('removes its chunks when deleted', function () {
    $source = Source::factory()->create();
    $chunk = Chunk::factory()->for($source)->create();

    expect($source->chunks->pluck('id')->all())->toBe([$chunk->id]);

    $source->delete();

    expect(Chunk::count())->toBe(0);
});
