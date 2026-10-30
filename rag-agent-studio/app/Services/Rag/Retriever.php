<?php

namespace App\Services\Rag;

use App\Contracts\EmbeddingProvider;
use App\Models\Agent;
use App\Models\Chunk;
use Illuminate\Support\Collection;

class Retriever
{
    public function __construct(private EmbeddingProvider $embeddings) {}

    /**
     * The agent's chunks that read most like the question, best first.
     *
     * @return Collection<int, Chunk>
     */
    public function retrieve(Agent $agent, string $query, int $k): Collection
    {
        $chunks = $agent->chunks()->with('source')->get();

        if ($chunks->isEmpty()) {
            return $chunks;
        }

        [$queryVector] = $this->embeddings->embed([$query]);

        return $chunks
            ->sortByDesc(fn (Chunk $chunk) => CosineSimilarity::between($queryVector, $chunk->embedding ?? []))
            ->take($k)
            ->values();
    }
}
