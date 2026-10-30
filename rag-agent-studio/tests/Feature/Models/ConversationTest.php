<?php

use App\Enums\ConversationOrigin;
use App\Enums\MessageRole;
use App\Models\Agent;
use App\Models\Conversation;
use App\Models\EmbedKey;
use App\Models\Message;

it('gets a visitor token and belongs to its assistant', function () {
    $agent = Agent::factory()->create();

    $conversation = Conversation::create([
        'organisation_id' => $agent->organisation_id,
        'agent_id' => $agent->id,
        'origin' => ConversationOrigin::Test,
    ]);

    expect($conversation->visitor_token)->toBeUuid()
        ->and($conversation->origin)->toBe(ConversationOrigin::Test)
        ->and($conversation->embed_key_id)->toBeNull()
        ->and($conversation->embedKey)->toBeNull()
        ->and($conversation->agent->is($agent))->toBeTrue()
        ->and($conversation->organisation->is($agent->organisation))->toBeTrue();
});

it('can start from a website share key', function () {
    $key = EmbedKey::factory()->create();
    $conversation = Conversation::factory()->embedded($key)->create();

    expect($conversation->origin)->toBe(ConversationOrigin::Embed)
        ->and($conversation->embedKey->is($key))->toBeTrue()
        ->and($conversation->agent_id)->toBe($key->agent_id);
});

it('keeps an explicit visitor token and lists messages in order', function () {
    $conversation = Conversation::factory()->create(['visitor_token' => '11111111-1111-4111-8111-111111111111']);
    $second = Message::factory()->for($conversation)->assistant()->create();
    $first = Message::factory()->for($conversation)->create(['created_at' => now()->subMinute()]);

    expect($conversation->visitor_token)->toBe('11111111-1111-4111-8111-111111111111')
        ->and($conversation->messages->pluck('id')->all())->toBe([$first->id, $second->id])
        ->and($second->role)->toBe(MessageRole::Assistant);
});

it('removes its messages when deleted', function () {
    $conversation = Conversation::factory()->create();
    Message::factory()->for($conversation)->create();

    $conversation->delete();

    expect(Message::count())->toBe(0);
});
