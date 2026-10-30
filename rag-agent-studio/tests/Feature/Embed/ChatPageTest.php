<?php

use App\Models\Agent;
use App\Models\EmbedKey;

it('shows the hosted chat page for a live assistant', function () {
    $agent = Agent::factory()->published()->create([
        'name' => 'Shop helper',
        'greeting' => 'Welcome! Ask me anything about the shop.',
        'accent_colour' => '#ff6600',
    ]);
    $key = EmbedKey::factory()->for($agent)->create();

    $this->get(route('chat.show', $key->public_key))
        ->assertOk()
        ->assertSee('Shop helper')
        ->assertSee('Welcome! Ask me anything about the shop.')
        ->assertSee('#ff6600', false)
        ->assertSee('Send')
        ->assertSee(route('api.chat', $key->public_key), false)
        ->assertSee(asset('chat.js'), false)
        ->assertDontSee('This assistant is currently unavailable.')
        ->assertDontSee('Assistant Studio');
});

it('ships the chat page script as plain browser javascript', function () {
    $script = file_get_contents(public_path('chat.js'));

    expect($script)->toContain('fetch(')
        ->and($script)->not->toContain('import ')
        ->and($script)->not->toContain('require(')
        ->and($script)->toContain('Based on:')
        ->and($script)->toContain('This assistant is currently unavailable.');
});

it('tells visitors when the assistant is offline', function (callable $makeAgent) {
    $key = EmbedKey::factory()->for($makeAgent())->create();

    $this->get(route('chat.show', $key->public_key))
        ->assertOk()
        ->assertSee('This assistant is currently unavailable.')
        ->assertDontSee('Send');
})->with([
    'offline' => fn () => Agent::factory()->unpublished()->create(),
    'draft' => fn () => Agent::factory()->create(),
]);

it('returns not found for an unknown or revoked key', function (callable $makeKey) {
    $this->get(route('chat.show', $makeKey()))->assertNotFound();
})->with([
    'unknown' => fn () => 'no-such-key-at-all',
    'revoked' => fn () => EmbedKey::factory()->revoked()->for(Agent::factory()->published())->create()->public_key,
]);
