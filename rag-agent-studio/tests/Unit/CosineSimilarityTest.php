<?php

use App\Services\Rag\CosineSimilarity;

it('scores identical directions as 1', function () {
    expect(CosineSimilarity::between([1.0, 2.0, 3.0], [2.0, 4.0, 6.0]))->toEqualWithDelta(1.0, 1e-9);
});

it('scores perpendicular vectors as 0', function () {
    expect(CosineSimilarity::between([1.0, 0.0], [0.0, 1.0]))->toEqualWithDelta(0.0, 1e-9);
});

it('scores opposite directions as -1', function () {
    expect(CosineSimilarity::between([1.0, 1.0], [-1.0, -1.0]))->toEqualWithDelta(-1.0, 1e-9);
});

it('matches a worked example', function () {
    // (1*4 + 2*5 + 3*6) / (sqrt(14) * sqrt(77)) = 32 / 32.8329...
    expect(CosineSimilarity::between([1.0, 2.0, 3.0], [4.0, 5.0, 6.0]))->toEqualWithDelta(0.9746318, 1e-6);
});

it('is 0 when either vector has no length', function () {
    expect(CosineSimilarity::between([0.0, 0.0], [1.0, 2.0]))->toBe(0.0)
        ->and(CosineSimilarity::between([1.0, 2.0], [0.0, 0.0]))->toBe(0.0)
        ->and(CosineSimilarity::between([], []))->toBe(0.0);
});
