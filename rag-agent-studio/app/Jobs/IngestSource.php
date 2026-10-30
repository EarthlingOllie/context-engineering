<?php

namespace App\Jobs;

use App\Contracts\EmbeddingProvider;
use App\Enums\SourceStatus;
use App\Models\Source;
use App\Services\Ingestion\Chunker;
use App\Services\Ingestion\ExtractionFailed;
use App\Services\Ingestion\TextExtractor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Throwable;

/** Reads a source, splits it into pieces and stores them so the assistant can use it. */
class IngestSource implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 300;

    public function __construct(public Source $source) {}

    public function handle(TextExtractor $extractor, EmbeddingProvider $embeddings): void
    {
        $this->source->update(['status' => SourceStatus::Processing, 'error_message' => null]);

        try {
            $text = $extractor->extract($this->source);
            $pieces = (new Chunker(config('studio.chunk_size'), config('studio.chunk_overlap')))->chunk($text);
            $vectors = $this->embed($embeddings, $pieces);

            DB::transaction(function () use ($pieces, $vectors) {
                $this->source->chunks()->delete();

                foreach ($pieces as $position => $content) {
                    $this->source->chunks()->create([
                        'organisation_id' => $this->source->organisation_id,
                        'agent_id' => $this->source->agent_id,
                        'position' => $position,
                        'content' => $content,
                        'embedding' => $vectors[$position],
                    ]);
                }

                $this->source->update(['status' => SourceStatus::Ready, 'chunk_count' => count($pieces)]);
            });
        } catch (ExtractionFailed $e) {
            $this->markFailed($e->getMessage());
        } catch (Throwable) {
            $this->markFailed('Something went wrong while reading this source. Please try again.');
        }
    }

    /**
     * @param  list<string>  $pieces
     * @return list<list<float>>
     */
    private function embed(EmbeddingProvider $embeddings, array $pieces): array
    {
        $vectors = [];

        foreach (array_chunk($pieces, max(1, (int) config('studio.embed_batch'))) as $batch) {
            array_push($vectors, ...$embeddings->embed($batch));
        }

        return $vectors;
    }

    private function markFailed(string $reason): void
    {
        $this->source->update(['status' => SourceStatus::Failed, 'error_message' => $reason]);
    }
}
