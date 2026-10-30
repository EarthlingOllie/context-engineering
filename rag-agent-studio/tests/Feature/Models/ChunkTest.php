<?php

use App\Models\Chunk;
use App\Models\Source;

it('stores its position, text and embedding and belongs to its source and assistant', function () {
    $source = Source::factory()->create();

    $chunk = Chunk::create([
        'organisation_id' => $source->organisation_id,
        'agent_id' => $source->agent_id,
        'source_id' => $source->id,
        'position' => 3,
        'content' => 'Some text',
        'embedding' => [0.1, 0.2],
    ]);

    $chunk->refresh();

    expect($chunk->position)->toBe(3)
        ->and($chunk->embedding)->toBe([0.1, 0.2])
        ->and($chunk->source->is($source))->toBeTrue()
        ->and($chunk->agent->is($source->agent))->toBeTrue()
        ->and($chunk->organisation->is($source->organisation))->toBeTrue();
});

it('has a factory that fills the ownership chain from the source', function () {
    $chunk = Chunk::factory()->create();

    expect($chunk->agent_id)->toBe($chunk->source->agent_id)
        ->and($chunk->organisation_id)->toBe($chunk->source->organisation_id)
        ->and($chunk->embedding)->toHaveCount(8);
});
