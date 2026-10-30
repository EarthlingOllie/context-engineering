<?php

use App\Contracts\AnswerProvider;
use App\Contracts\EmbeddingProvider;
use App\Contracts\UrlFetcher;
use App\Drivers\ClaudeAnswerProvider;
use App\Drivers\FakeAnswerProvider;
use App\Drivers\FakeEmbeddingProvider;
use App\Drivers\FakeUrlFetcher;
use App\Drivers\HttpUrlFetcher;
use App\Drivers\VoyageEmbeddingProvider;

it('uses the fake drivers while testing', function () {
    expect(app(EmbeddingProvider::class))->toBeInstanceOf(FakeEmbeddingProvider::class)
        ->and(app(AnswerProvider::class))->toBeInstanceOf(FakeAnswerProvider::class)
        ->and(app(UrlFetcher::class))->toBeInstanceOf(FakeUrlFetcher::class);
});

it('uses the real drivers when configured', function () {
    config([
        'studio.embedding_driver' => 'real',
        'studio.answer_driver' => 'real',
        'studio.url_fetch_driver' => 'real',
    ]);

    expect(app(EmbeddingProvider::class))->toBeInstanceOf(VoyageEmbeddingProvider::class)
        ->and(app(AnswerProvider::class))->toBeInstanceOf(ClaudeAnswerProvider::class)
        ->and(app(UrlFetcher::class))->toBeInstanceOf(HttpUrlFetcher::class);
});

it('ships the defaults the pipeline relies on', function () {
    expect(config('studio.chunk_size'))->toBe(800)
        ->and(config('studio.chunk_overlap'))->toBe(150)
        ->and(config('studio.embed_batch'))->toBe(32)
        ->and(config('studio.top_k'))->toBe(6)
        ->and(config('studio.history_turns'))->toBe(10)
        ->and(config('studio.max_file_mb'))->toBe(10)
        ->and(config('studio.answer_model'))->toBe('claude-sonnet-4-5')
        ->and(config('studio.embedding_model'))->toBe('voyage-3')
        ->and(config('cors.paths'))->toBe(['api/chat/*', 'embed/*'])
        ->and(config('cors.allowed_origins'))->toBe(['*']);
});
