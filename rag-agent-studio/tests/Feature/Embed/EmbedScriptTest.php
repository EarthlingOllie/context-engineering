<?php

use App\Models\Agent;
use App\Models\EmbedKey;

it('serves the widget loader for a live assistant', function () {
    config(['app.url' => 'https://studio.example']);
    $agent = Agent::factory()->published()->create(['accent_colour' => '#ff6600', 'name' => 'Shop helper']);
    $key = EmbedKey::factory()->for($agent)->create();

    $response = $this->get(route('embed.script', $key->public_key));

    $response->assertOk()
        ->assertHeader('Content-Type', 'application/javascript; charset=UTF-8')
        ->assertHeader('Cache-Control', 'max-age=300, public')
        ->assertSee('#ff6600', false)
        ->assertSee('Shop helper', false)
        ->assertSee('https://studio.example/chat/'.$key->public_key.'?embedded=1', false)
        ->assertSee('380px', false)
        ->assertSee('600px', false)
        ->assertSee('position:fixed', false)
        ->assertSee('bottom:', false)
        ->assertSee('right:', false)
        ->assertSee('iframe', false);
});

it('serves a harmless empty script when the key is unknown, revoked or the assistant is not live', function (callable $makeKey) {
    $publicKey = $makeKey();

    $response = $this->get(route('embed.script', $publicKey));

    $response->assertOk()
        ->assertHeader('Content-Type', 'application/javascript; charset=UTF-8')
        ->assertHeader('Cache-Control', 'max-age=300, public')
        ->assertDontSee('iframe', false)
        ->assertDontSee('chat/', false);
})->with([
    'unknown' => fn () => 'no-such-key-at-all',
    'revoked' => fn () => EmbedKey::factory()->revoked()->for(Agent::factory()->published())->create()->public_key,
    'offline' => fn () => EmbedKey::factory()->for(Agent::factory()->unpublished())->create()->public_key,
    'draft' => fn () => EmbedKey::factory()->for(Agent::factory())->create()->public_key,
]);

it('lets any website load the loader', function () {
    $key = EmbedKey::factory()->for(Agent::factory()->published())->create();

    $this->get(route('embed.script', $key->public_key), ['Origin' => 'https://customer.example'])
        ->assertOk()
        ->assertHeader('Access-Control-Allow-Origin', '*');
});
