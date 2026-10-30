<?php

use App\Enums\ConversationOrigin;
use App\Http\Controllers\ChatApiController;
use App\Models\Agent;
use App\Models\Chunk;
use App\Models\Conversation;
use App\Models\EmbedKey;
use App\Models\Source;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

function liveKey(): EmbedKey
{
    $agent = Agent::factory()->published()->create();
    $source = Source::factory()->ready()->for($agent)->create(['title' => 'Opening hours']);
    Chunk::factory()->for($source)->create(['content' => 'We open at 9.']);

    return EmbedKey::factory()->for($agent)->create();
}

it('is registered as the chat api with the chat rate limiter and no csrf check', function () {
    $route = Route::getRoutes()->getByName('api.chat');

    expect($route)->not->toBeNull()
        ->and($route->methods())->toContain('POST')
        ->and($route->uri())->toBe('api/chat/{public_key}')
        ->and($route->getActionName())->toBe(ChatApiController::class)
        ->and($route->gatherMiddleware())->toContain('throttle:chat')
        ->and($route->gatherMiddleware())->not->toContain(VerifyCsrfToken::class)
        ->and(RateLimiter::limiter('chat'))->not->toBeNull();
});

it('answers a visitor and starts a conversation for them', function () {
    $key = liveKey();

    $response = $this->postJson(route('api.chat', $key->public_key), ['message' => 'When do you open?']);

    $response->assertOk()->assertJson([
        'reply' => 'Fake answer about: When do you open?',
        'sources' => [['title' => 'Opening hours']],
    ]);

    $conversation = Conversation::where('visitor_token', $response->json('conversation_id'))->first();
    expect($conversation)->not->toBeNull()
        ->and($conversation->agent_id)->toBe($key->agent_id)
        ->and($conversation->embed_key_id)->toBe($key->id)
        ->and($conversation->organisation_id)->toBe($key->organisation_id)
        ->and($conversation->origin)->toBe(ConversationOrigin::Embed)
        ->and($conversation->messages()->count())->toBe(2)
        ->and($response->json('sources'))->toBe([['title' => 'Opening hours']]);
});

it('continues the same conversation when the visitor sends their conversation id', function () {
    $key = liveKey();
    $first = $this->postJson(route('api.chat', $key->public_key), ['message' => 'Hello']);

    $second = $this->postJson(route('api.chat', $key->public_key), [
        'message' => 'And again',
        'conversation_id' => $first->json('conversation_id'),
    ]);

    expect($second->json('conversation_id'))->toBe($first->json('conversation_id'))
        ->and(Conversation::count())->toBe(1)
        ->and(Conversation::first()->messages()->count())->toBe(4);
});

it('starts afresh when the conversation id is unknown or belongs to another assistant', function () {
    $key = liveKey();
    $other = Conversation::factory()->create();

    $response = $this->postJson(route('api.chat', $key->public_key), [
        'message' => 'Hello',
        'conversation_id' => $other->visitor_token,
    ]);

    $response->assertOk();
    expect($response->json('conversation_id'))->not->toBe($other->visitor_token)
        ->and($other->messages()->count())->toBe(0)
        ->and(Conversation::count())->toBe(2);
});

it('is not found for an unknown or revoked key', function () {
    $this->postJson(route('api.chat', 'nope'), ['message' => 'Hello'])->assertNotFound();

    $revoked = EmbedKey::factory()->revoked()->for(Agent::factory()->published())->create();
    $this->postJson(route('api.chat', $revoked->public_key), ['message' => 'Hello'])->assertNotFound();
});

it('is unavailable while the assistant is not live', function (?string $state) {
    $agent = $state ? Agent::factory()->{$state}() : Agent::factory();
    $key = EmbedKey::factory()->for($agent)->create();

    $this->postJson(route('api.chat', $key->public_key), ['message' => 'Hello'])
        ->assertForbidden()
        ->assertExactJson(['error' => 'unavailable']);
})->with(['draft' => null, 'offline' => 'unpublished']);

it('rejects an empty or overlong message', function (array $payload) {
    $key = liveKey();

    $this->postJson(route('api.chat', $key->public_key), $payload)
        ->assertUnprocessable()
        ->assertJsonPath('error', 'invalid');

    expect(Conversation::count())->toBe(0);
})->with([
    'missing' => [[]],
    'empty' => [['message' => '']],
    'blank' => [['message' => '   ']],
    'too long' => [['message' => str_repeat('a', 2001)]],
    'not text' => [['message' => ['nested']]],
]);

it('rejects bad input with 422 even from a plain form post', function () {
    $key = liveKey();

    $this->post(route('api.chat', $key->public_key), ['message' => ''])->assertUnprocessable();
});

it('accepts a message of exactly 2000 characters', function () {
    $key = liveKey();

    $this->postJson(route('api.chat', $key->public_key), ['message' => str_repeat('a', 2000)])->assertOk();
});

it('rate limits each key and visitor to 30 messages a minute', function () {
    $key = liveKey();

    foreach (range(1, 30) as $i) {
        $this->postJson(route('api.chat', $key->public_key), ['message' => "Hi {$i}"])->assertOk();
    }

    $this->postJson(route('api.chat', $key->public_key), ['message' => 'One more'])->assertStatus(429);

    $otherKey = liveKey();
    $this->postJson(route('api.chat', $otherKey->public_key), ['message' => 'Hi'])->assertOk();
});

it('counts the limit per visitor address', function () {
    $key = liveKey();

    foreach (range(1, 30) as $i) {
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
            ->postJson(route('api.chat', $key->public_key), ['message' => "Hi {$i}"])->assertOk();
    }
    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
        ->postJson(route('api.chat', $key->public_key), ['message' => 'One more'])->assertStatus(429);

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
        ->postJson(route('api.chat', $key->public_key), ['message' => 'Hi from elsewhere'])->assertOk();
});

it('allows cross-origin calls from any website', function () {
    $key = liveKey();

    $this->postJson(route('api.chat', $key->public_key), ['message' => 'Hi'], ['Origin' => 'https://customer.example'])
        ->assertOk()
        ->assertHeader('Access-Control-Allow-Origin', '*');

    $this->options(route('api.chat', $key->public_key), [], [
        'Origin' => 'https://customer.example',
        'Access-Control-Request-Method' => 'POST',
    ])->assertNoContent()->assertHeader('Access-Control-Allow-Origin', '*');
});
