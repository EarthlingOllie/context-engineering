<?php

namespace App\Providers;

use App\Contracts\AnswerProvider;
use App\Contracts\EmbeddingProvider;
use App\Contracts\UrlFetcher;
use App\Drivers\ClaudeAnswerProvider;
use App\Drivers\FakeAnswerProvider;
use App\Drivers\FakeEmbeddingProvider;
use App\Drivers\FakeUrlFetcher;
use App\Drivers\HttpUrlFetcher;
use App\Drivers\VoyageEmbeddingProvider;
use Illuminate\Support\ServiceProvider;

class StudioServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(EmbeddingProvider::class, fn () => config('studio.embedding_driver') === 'real'
            ? new VoyageEmbeddingProvider
            : new FakeEmbeddingProvider);

        $this->app->bind(AnswerProvider::class, fn () => config('studio.answer_driver') === 'real'
            ? new ClaudeAnswerProvider
            : new FakeAnswerProvider);

        $this->app->bind(UrlFetcher::class, fn () => config('studio.url_fetch_driver') === 'real'
            ? new HttpUrlFetcher
            : new FakeUrlFetcher);
    }
}
