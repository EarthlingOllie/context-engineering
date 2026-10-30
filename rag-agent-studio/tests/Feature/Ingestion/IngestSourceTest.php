<?php

use App\Contracts\EmbeddingProvider;
use App\Enums\SourceStatus;
use App\Jobs\IngestSource;
use App\Models\Chunk;
use App\Models\Source;
use App\Services\Ingestion\TextExtractor;
use Illuminate\Contracts\Queue\ShouldQueue;

it('reads, splits and stores a source so it becomes ready', function () {
    $source = Source::factory()->create(['raw_text' => "Opening hours.\n\nWe open at nine."]);

    IngestSource::dispatchSync($source);

    $source->refresh();

    expect($source->status)->toBe(SourceStatus::Ready)
        ->and($source->error_message)->toBeNull()
        ->and($source->chunk_count)->toBe(1)
        ->and($source->chunks)->toHaveCount(1);

    $chunk = $source->chunks->first();

    expect($chunk->content)->toBe("Opening hours.\nWe open at nine.")
        ->and($chunk->position)->toBe(0)
        ->and($chunk->agent_id)->toBe($source->agent_id)
        ->and($chunk->organisation_id)->toBe($source->organisation_id)
        ->and($chunk->embedding)->toHaveCount(8)
        ->and($chunk->embedding)->toBe(app(EmbeddingProvider::class)->embed(["Opening hours.\nWe open at nine."])[0]);
});

it('shows the source as being read while it works', function () {
    $seen = null;
    app()->bind(TextExtractor::class, function () use (&$seen) {
        return new class($seen) extends TextExtractor
        {
            public function __construct(public mixed &$seen) {}

            public function extract(Source $source): string
            {
                $this->seen = $source->fresh()->status;

                return 'Some text.';
            }
        };
    });
    $source = Source::factory()->create();

    IngestSource::dispatchSync($source);

    expect($seen)->toBe(SourceStatus::Processing)
        ->and($source->fresh()->status)->toBe(SourceStatus::Ready);
});

it('replaces whatever it stored before', function () {
    $source = Source::factory()->ready()->create(['raw_text' => 'New words.']);
    $old = Chunk::factory()->for($source)->create(['content' => 'Old words.']);

    IngestSource::dispatchSync($source);

    expect(Chunk::find($old->id))->toBeNull()
        ->and($source->fresh()->chunks()->pluck('content')->all())->toBe(['New words.'])
        ->and($source->fresh()->chunk_count)->toBe(1);
});

it('splits long text using the knowledge settings and numbers the pieces', function () {
    config(['studio.chunk_size' => 60, 'studio.chunk_overlap' => 10]);
    $source = Source::factory()->create(['raw_text' => str_repeat('A short sentence here. ', 12)]);

    IngestSource::dispatchSync($source);

    $chunks = $source->fresh()->chunks()->orderBy('position')->get();

    expect($chunks->count())->toBeGreaterThan(3)
        ->and($chunks->pluck('position')->all())->toBe(range(0, $chunks->count() - 1))
        ->and($source->fresh()->chunk_count)->toBe($chunks->count());

    foreach ($chunks as $chunk) {
        expect(mb_strlen($chunk->content))->toBeLessThanOrEqual(60);
    }
});

it('sends the pieces for embedding a batch at a time', function () {
    config(['studio.chunk_size' => 30, 'studio.chunk_overlap' => 0, 'studio.embed_batch' => 2]);
    $batches = [];
    app()->instance(EmbeddingProvider::class, new class($batches) implements EmbeddingProvider
    {
        public function __construct(public array &$batches) {}

        public function embed(array $texts): array
        {
            $this->batches[] = count($texts);

            return array_map(fn () => [0.5, 0.25], $texts);
        }
    });
    $source = Source::factory()->create(['raw_text' => implode("\n\n", array_fill(0, 5, 'Twenty-five characters.'))]);

    IngestSource::dispatchSync($source);

    expect($batches)->toBe([2, 2, 1])
        ->and($source->fresh()->chunks()->count())->toBe(5)
        ->and($source->fresh()->chunks()->first()->embedding)->toBe([0.5, 0.25]);
});

it('records a plain-English reason when the source cannot be read', function () {
    $source = Source::factory()->create(['raw_text' => '   ']);

    IngestSource::dispatchSync($source);

    $source->refresh();

    expect($source->status)->toBe(SourceStatus::Failed)
        ->and($source->error_message)->toBe("There's no text to read in this source")
        ->and($source->chunk_count)->toBe(0)
        ->and($source->chunks)->toHaveCount(0);
});

it('keeps the reason generic when something unexpected goes wrong', function () {
    app()->instance(EmbeddingProvider::class, new class implements EmbeddingProvider
    {
        public function embed(array $texts): array
        {
            throw new RuntimeException('socket closed');
        }
    });
    $source = Source::factory()->create();

    IngestSource::dispatchSync($source);

    expect($source->fresh()->status)->toBe(SourceStatus::Failed)
        ->and($source->fresh()->error_message)->toBe('Something went wrong while reading this source. Please try again.');
});

it('clears an old reason once the source is read successfully', function () {
    $source = Source::factory()->failed()->create(['raw_text' => 'Fine now.']);

    IngestSource::dispatchSync($source);

    expect($source->fresh()->status)->toBe(SourceStatus::Ready)
        ->and($source->fresh()->error_message)->toBeNull();
});

it('runs once in the background with a five minute limit', function () {
    $job = new IngestSource(Source::factory()->create());

    expect($job)->toBeInstanceOf(ShouldQueue::class)
        ->and($job->tries)->toBe(1)
        ->and($job->timeout)->toBe(300);
});
