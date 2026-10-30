<?php

use App\Enums\AgentStatus;
use App\Livewire\Agents\AgentShare;
use App\Models\Agent;
use App\Models\EmbedKey;
use App\Models\Project;
use App\Models\Source;
use App\Models\User;
use Livewire\Livewire;

function draftAgent(User $user, bool $ready = true): Agent
{
    $agent = Agent::factory()->for(Project::factory()->for($user->organisation))->create(['name' => 'Shop helper']);

    if ($ready) {
        Source::factory()->ready()->for($agent)->create();
    }

    return $agent;
}

function liveAgent(User $user): Agent
{
    $agent = Agent::factory()->published()->for(Project::factory()->for($user->organisation))->create(['name' => 'Shop helper']);
    Source::factory()->ready()->for($agent)->create();
    EmbedKey::factory()->for($agent)->create();

    return $agent;
}

it('shows a draft assistant with a publish button and no link yet', function () {
    $user = User::factory()->create();
    $agent = draftAgent($user);

    $this->actingAs($user)
        ->get(route('agents.share', $agent))
        ->assertOk()
        ->assertSeeLivewire(AgentShare::class)
        ->assertSeeInOrder(['Setup', 'Knowledge', 'Test', 'Share'])
        ->assertSee('Shop helper')
        ->assertSee('Draft')
        ->assertSee('Publish')
        ->assertSee('not live yet')
        ->assertDontSee('Take offline')
        ->assertDontSee('Reset link')
        ->assertDontSee('Website snippet')
        ->assertDontSee('Copy')
        ->assertDontSee('/chat/');
});

it('keeps people out of share pages in other workspaces', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->create();

    $this->actingAs($user)->get(route('agents.share', $agent))->assertForbidden();
});

it('disables publishing until a source is ready and explains why', function () {
    $user = User::factory()->create();
    $agent = draftAgent($user, ready: false);

    Livewire::actingAs($user)
        ->test(AgentShare::class, ['agent' => $agent])
        ->assertSeeHtml('wire:click="publish" disabled')
        ->assertSee('Add at least one ready source')
        ->assertSeeHtml('href="'.route('agents.knowledge', $agent).'"')
        ->call('publish')
        ->assertSee('Add at least one ready source');

    expect($agent->fresh()->status)->toBe(AgentStatus::Draft)
        ->and(EmbedKey::count())->toBe(0);
});

it('publishes the assistant and shows the website snippet and share link', function () {
    config(['app.url' => 'https://studio.example']);
    $user = User::factory()->create();
    $agent = draftAgent($user);

    $component = Livewire::actingAs($user)
        ->test(AgentShare::class, ['agent' => $agent])
        ->assertDontSeeHtml('wire:click="publish" disabled')
        ->call('publish')
        ->assertHasNoErrors();

    $agent->refresh();
    $key = $agent->embedKey;

    expect($agent->status)->toBe(AgentStatus::Published)
        ->and($key)->not->toBeNull();

    $component
        ->assertSee('Live')
        ->assertSee('is live')
        ->assertSee('Website snippet')
        ->assertSeeHtml(e('<script src="https://studio.example/embed/'.$key->public_key.'.js" async></script>'))
        ->assertSee('Share link')
        ->assertSee('https://studio.example/chat/'.$key->public_key)
        ->assertSee('If someone else looks after your website, send them this line and ask them to add it.')
        ->assertSee('Custom code')
        ->assertSee('Copy')
        ->assertSee('Take offline')
        ->assertSee('Reset link')
        ->assertDontSee('Publish');
});

it('takes a live assistant offline and says the link no longer works', function () {
    $user = User::factory()->create();
    $agent = liveAgent($user);

    Livewire::actingAs($user)
        ->test(AgentShare::class, ['agent' => $agent])
        ->call('takeOffline')
        ->assertSee('Offline')
        ->assertSee('is offline')
        ->assertSee('"currently unavailable" message')
        ->assertSee('Publish')
        ->assertDontSee('Take offline')
        ->assertDontSee('Website snippet')
        ->assertDontSee('/chat/');

    expect($agent->fresh()->status)->toBe(AgentStatus::Unpublished);
});

it('publishes an offline assistant again with the same link', function () {
    $user = User::factory()->create();
    $agent = liveAgent($user);
    $key = $agent->embedKey;

    Livewire::actingAs($user)
        ->test(AgentShare::class, ['agent' => $agent])
        ->call('takeOffline')
        ->call('publish')
        ->assertSee('Live')
        ->assertSee('/chat/'.$key->public_key);

    expect($agent->fresh()->status)->toBe(AgentStatus::Published)
        ->and(EmbedKey::count())->toBe(1);
});

it('resets the link after confirming, so the old link stops working', function () {
    $user = User::factory()->create();
    $agent = liveAgent($user);
    $oldKey = $agent->embedKey->public_key;

    Livewire::actingAs($user)
        ->test(AgentShare::class, ['agent' => $agent])
        ->assertSeeHtml('wire:confirm')
        ->call('resetLink')
        ->assertDontSee($oldKey)
        ->assertSee('/chat/'.$agent->fresh()->embedKey->public_key);

    expect($agent->fresh()->embedKey->public_key)->not->toBe($oldKey)
        ->and(EmbedKey::where('public_key', $oldKey)->sole()->isActive())->toBeFalse()
        ->and($this->get(route('chat.show', $oldKey))->status())->toBe(404);
});

it('never shows technical words on the share screen', function () {
    $user = User::factory()->create();
    $agent = liveAgent($user);

    $text = strip_tags(Livewire::actingAs($user)->test(AgentShare::class, ['agent' => $agent])->html());

    foreach (['embed code', 'iframe', 'public key', 'published', 'unpublished', 'api', 'token', 'agent', 'key'] as $jargon) {
        expect(preg_match('/\b'.$jargon.'\b/i', $text))->toBe(0, "'{$jargon}' appears on the share screen");
    }
});
