<?php

use App\Drivers\VoyageEmbeddingProvider;
use Illuminate\Http\Client\ConnectionException;
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

it('fails loudly when Voyage sends back something it cannot read', function (array|string $body) {
    Http::fake(['api.voyageai.com/*' => Http::response($body)]);

    (new VoyageEmbeddingProvider)->embed(['a', 'b']);
})->with([
    'no data' => [['object' => 'list']],
    'too few vectors' => [['data' => [['index' => 0, 'embedding' => [0.1]]]]],
    'vector missing' => [['data' => [['index' => 0], ['index' => 1, 'embedding' => [0.2]]]]],
    'not json' => ['<html>Bad gateway</html>'],
])->throws(RuntimeException::class, 'The embedding service sent back something unexpected');

it('fails loudly when Voyage cannot be reached', function () {
    Http::fake(['api.voyageai.com/*' => Http::failedConnection()]);

    (new VoyageEmbeddingProvider)->embed(['a']);
})->throws(ConnectionException::class);
