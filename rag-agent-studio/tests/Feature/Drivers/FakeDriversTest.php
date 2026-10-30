<?php

use App\Drivers\FakeAnswerProvider;
use App\Drivers\FakeEmbeddingProvider;
use App\Drivers\FakeUrlFetcher;

it('embeds text deterministically into 8 numbers', function () {
    $provider = new FakeEmbeddingProvider;

    $first = $provider->embed(['hello', 'world']);
    $again = $provider->embed(['hello']);

    expect($first)->toHaveCount(2)
        ->and($first[0])->toHaveCount(8)
        ->and($first[0])->each->toBeFloat()
        ->and($first[0])->toBe($again[0])
        ->and($first[0])->not->toBe($first[1]);
});

it('answers with a fake reply about the last visitor message', function () {
    $provider = new FakeAnswerProvider;

    $reply = $provider->answer('You are helpful.', [
        ['role' => 'user', 'content' => 'When do you open?'],
        ['role' => 'assistant', 'content' => 'At 9.'],
        ['role' => 'user', 'content' => 'And close?'],
    ]);

    expect($reply)->toBe('Fake answer about: And close?');
});

it('answers about nothing when there is no visitor message', function () {
    expect((new FakeAnswerProvider)->answer('System', []))->toBe('Fake answer about: ');
});

it('fetches a fake web page', function () {
    expect((new FakeUrlFetcher)->fetch('https://example.com/faq'))
        ->toBe('<html><body><p>Fake page content for https://example.com/faq.</p></body></html>');
});
