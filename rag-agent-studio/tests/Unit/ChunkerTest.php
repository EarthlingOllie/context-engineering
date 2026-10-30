<?php

use App\Services\Ingestion\Chunker;

it('returns nothing for empty or blank text', function () {
    $chunker = new Chunker;

    expect($chunker->chunk(''))->toBe([])
        ->and($chunker->chunk("  \n\n \t "))->toBe([]);
});

it('keeps short text as a single trimmed chunk', function () {
    expect((new Chunker)->chunk("  Hello there.  \n"))->toBe(['Hello there.']);
});

it('joins short paragraphs into one chunk and drops blank ones', function () {
    $text = "First paragraph.\n\n\n   \n\nSecond paragraph.\r\n\r\nThird.";

    expect((new Chunker)->chunk($text))->toBe(["First paragraph.\nSecond paragraph.\nThird."]);
});

it('never produces a chunk longer than the size', function () {
    $sentence = 'The quick brown fox jumps over the lazy dog. ';
    $text = str_repeat($sentence, 60); // ~2700 chars in one paragraph

    $chunks = (new Chunker(size: 800, overlap: 150))->chunk($text);

    expect(count($chunks))->toBeGreaterThan(3);
    foreach ($chunks as $chunk) {
        expect(mb_strlen($chunk))->toBeLessThanOrEqual(800)
            ->and($chunk)->toEndWith('dog.');
    }
});

it('overlaps the end of one chunk with the start of the next', function () {
    $text = '';
    for ($i = 1; $i <= 40; $i++) {
        $text .= "Sentence number {$i} is here. ";
    }

    $chunks = (new Chunker(size: 200, overlap: 60))->chunk($text);

    expect(count($chunks))->toBeGreaterThan(2);

    for ($i = 1; $i < count($chunks); $i++) {
        $previous = $chunks[$i - 1];
        $tail = mb_substr($previous, -40);
        expect($chunks[$i])->toContain(trim(mb_substr($tail, mb_strpos($tail, 'Sentence'))));
        expect(str_starts_with($chunks[$i], 'Sentence number'))->toBeTrue();
    }
});

it('splits a single unbroken run of characters that is longer than the size', function () {
    $chunks = (new Chunker(size: 10, overlap: 0))->chunk(str_repeat('a', 25));

    expect($chunks)->toBe(['aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaa']);
});

it('starts a fresh chunk without overlap when the next piece nearly fills it', function () {
    $first = str_repeat('x', 95).'.';
    $second = str_repeat('y', 99).'.';

    $chunks = (new Chunker(size: 100, overlap: 30))->chunk("{$first}\n\n{$second}");

    expect($chunks)->toBe([$first, $second]);
});

it('reads its defaults from the knowledge settings', function () {
    $chunker = new Chunker;

    expect($chunker->size)->toBe(800)->and($chunker->overlap)->toBe(150);
});

it('starts the overlap at a word when the tail has no sentence end', function () {
    $chunks = (new Chunker(size: 20, overlap: 8))->chunk('alpha beta gamma delta epsilon zeta eta');

    expect($chunks)->toBe(['alpha beta gamma', 'delta epsilon zeta', 'zeta eta']);
});

it('uses the raw tail when it has no word break at all', function () {
    $chunks = (new Chunker(size: 10, overlap: 4))->chunk('aaaaaaaaaa bbbbbbbbbb');

    expect($chunks)->toBe(['aaaaaaaaaa', 'bbbbbbbbbb']);
});
