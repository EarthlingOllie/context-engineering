<?php

namespace App\Drivers;

use App\Contracts\EmbeddingProvider;
use Illuminate\Support\Facades\Http;

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

        return collect($response->json('data'))
            ->sortBy('index')
            ->pluck('embedding')
            ->values()
            ->all();
    }
}
