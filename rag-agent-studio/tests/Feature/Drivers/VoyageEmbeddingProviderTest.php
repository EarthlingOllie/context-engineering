<?php

use App\Drivers\VoyageEmbeddingProvider;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

it('sends texts to Voyage and returns the embeddings in order', function () {
    config(['studio.voyage_api_key' => 'voyage-key', 'studio.embedding_model' => 'voyage-3']);
    Http::fake([
        'api.voyageai.com/v1/embeddings' => Http::response([
            'data' => [
                ['index' => 0, 'embedding' => [0.1, 0.2]],
                ['index' => 1, 'embedding' => [0.3, 0.4]],
            ],
        ]),
    ]);

    $vectors = (new VoyageEmbeddingProvider)->embed(['a', 'b']);

    expect($vectors)->toBe([[0.1, 0.2], [0.3, 0.4]]);
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.voyageai.com/v1/embeddings'
        && $request->hasHeader('Authorization', 'Bearer voyage-key')
        && $request['input'] === ['a', 'b']
        && $request['model'] === 'voyage-3');
});

it('fails loudly when Voyage rejects the request', function () {
    Http::fake(['api.voyageai.com/*' => Http::response(['error' => 'bad key'], 401)]);

    (new VoyageEmbeddingProvider)->embed(['a']);
})->throws(RequestException::class);
