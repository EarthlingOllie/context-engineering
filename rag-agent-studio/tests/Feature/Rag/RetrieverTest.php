<?php

use App\Contracts\EmbeddingProvider;
use App\Models\Agent;
use App\Models\Chunk;
use App\Models\Source;
use App\Services\Rag\Retriever;

/** An embedding provider whose vectors we choose by hand, so similarity is predictable. */
function vectorsByText(array $map): EmbeddingProvider
{
    return new class($map) implements EmbeddingProvider
    {
        public function __construct(private array $map) {}

        public function embed(array $texts): array
        {
            return array_map(fn (string $text) => $this->map[$text], $texts);
        }
    };
}

it('returns the k chunks closest to the question, best first', function () {
    $agent = Agent::factory()->create();
    $source = Source::factory()->ready()->for($agent)->create();
    $near = Chunk::factory()->for($source)->create(['content' => 'near', 'embedding' => [1.0, 0.1]]);
    $far = Chunk::factory()->for($source)->create(['content' => 'far', 'embedding' => [0.0, 1.0]]);
    $middle = Chunk::factory()->for($source)->create(['content' => 'middle', 'embedding' => [1.0, 1.0]]);

    $retriever = new Retriever(vectorsByText(['hours?' => [1.0, 0.0]]));
    $found = $retriever->retrieve($agent, 'hours?', 2);

    expect($found->pluck('id')->all())->toBe([$near->id, $middle->id])
        ->and($found->first())->toBeInstanceOf(Chunk::class);
});

it('only looks at the agent\'s own chunks', function () {
    $agent = Agent::factory()->create();
    $other = Agent::factory()->create();
    $mine = Chunk::factory()->for(Source::factory()->for($agent))->create(['embedding' => [0.0, 1.0]]);
    Chunk::factory()->for(Source::factory()->for($other))->create(['embedding' => [1.0, 0.0]]);

    $found = (new Retriever(vectorsByText(['q' => [1.0, 0.0]])))->retrieve($agent, 'q', 6);

    expect($found->pluck('id')->all())->toBe([$mine->id]);
});

it('returns nothing when the agent has no chunks', function () {
    $agent = Agent::factory()->create();

    $found = (new Retriever(vectorsByText(['q' => [1.0, 0.0]])))->retrieve($agent, 'q', 6);

    expect($found)->toBeEmpty();
});

it('uses the configured embedding provider when resolved from the container', function () {
    $agent = Agent::factory()->create();
    $chunk = Chunk::factory()->for(Source::factory()->for($agent))->create(['embedding' => [0.5, 0.5]]);

    $found = app(Retriever::class)->retrieve($agent, 'anything', 6);

    expect($found->pluck('id')->all())->toBe([$chunk->id]);
});
