<?php

namespace App\Drivers;

use App\Contracts\EmbeddingProvider;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class VoyageEmbeddingProvider implements EmbeddingProvider
{
    public function embed(array $texts): array
    {
        $response = Http::withToken(config('studio.voyage_api_key'))
            ->post('https://api.voyageai.com/v1/embeddings', [
                'input' => $texts,
                'model' => config('studio.embedding_model'),
            ])
            ->throw();

        $vectors = collect(is_array($response->json('data')) ? $response->json('data') : [])
            ->sortBy('index')
            ->pluck('embedding')
            ->values();

        if ($vectors->count() !== count($texts) || $vectors->contains(fn ($vector) => ! is_array($vector))) {
            throw new RuntimeException('The embedding service sent back something unexpected');
        }

        return $vectors->all();
    }
}
