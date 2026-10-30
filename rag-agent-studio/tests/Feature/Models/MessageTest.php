<?php

use App\Enums\MessageRole;
use App\Models\Conversation;
use App\Models\Message;

it('stores who wrote it, the text and the sources it was based on', function () {
    $conversation = Conversation::factory()->create();

    $message = Message::create([
        'conversation_id' => $conversation->id,
        'role' => MessageRole::Assistant,
        'content' => 'We open at 9.',
        'sources' => [['source_id' => 5, 'title' => 'Opening hours']],
    ]);

    $message->refresh();

    expect($message->role)->toBe(MessageRole::Assistant)
        ->and($message->sources)->toBe([['source_id' => 5, 'title' => 'Opening hours']])
        ->and($message->conversation->is($conversation))->toBeTrue();
});

it('defaults to a visitor message with no sources', function () {
    $message = Message::factory()->create();

    expect($message->role)->toBe(MessageRole::User)
        ->and($message->sources)->toBe([]);
});
