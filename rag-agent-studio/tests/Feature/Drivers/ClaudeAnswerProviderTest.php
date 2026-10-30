<?php

use App\Drivers\ClaudeAnswerProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

it('asks Claude with the system prompt and conversation and returns the text', function () {
    config(['studio.anthropic_api_key' => 'claude-key', 'studio.answer_model' => 'claude-sonnet-4-5']);
    Http::fake([
        'api.anthropic.com/v1/messages' => Http::response([
            'content' => [['type' => 'text', 'text' => 'We open at 9.']],
        ]),
    ]);

    $messages = [['role' => 'user', 'content' => 'When do you open?']];
    $reply = (new ClaudeAnswerProvider)->answer('Be brief.', $messages);

    expect($reply)->toBe('We open at 9.');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'claude-key')
        && $request->hasHeader('anthropic-version', '2023-06-01')
        && $request['model'] === 'claude-sonnet-4-5'
        && $request['system'] === 'Be brief.'
        && $request['messages'] === $messages
        && $request['max_tokens'] === 1024);
});

it('joins several text blocks into one reply', function () {
    Http::fake([
        'api.anthropic.com/*' => Http::response([
            'content' => [['type' => 'text', 'text' => 'One.'], ['type' => 'text', 'text' => 'Two.']],
        ]),
    ]);

    expect((new ClaudeAnswerProvider)->answer('s', []))->toBe('One. Two.');
});

it('fails loudly when Claude rejects the request', function () {
    Http::fake(['api.anthropic.com/*' => Http::response(['error' => 'overloaded'], 529)]);

    (new ClaudeAnswerProvider)->answer('s', []);
})->throws(RequestException::class);

it('fails loudly when Claude sends back something it cannot read', function (array|string $body) {
    Http::fake(['api.anthropic.com/*' => Http::response($body)]);

    (new ClaudeAnswerProvider)->answer('s', [['role' => 'user', 'content' => 'Hi']]);
})->with([
    'no content' => [['id' => 'msg_1']],
    'no text blocks' => [['content' => [['type' => 'tool_use']]]],
    'not json' => ['<html>Bad gateway</html>'],
])->throws(RuntimeException::class, 'The answer service sent back something unexpected');

it('fails loudly when Claude cannot be reached', function () {
    Http::fake(['api.anthropic.com/*' => Http::failedConnection()]);

    (new ClaudeAnswerProvider)->answer('s', []);
})->throws(ConnectionException::class);
