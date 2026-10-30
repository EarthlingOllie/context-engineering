<?php

use App\Enums\ConversationOrigin;
use App\Livewire\Agents\AgentTest;
use App\Models\Agent;
use App\Models\Chunk;
use App\Models\Conversation;
use App\Models\Project;
use App\Models\Source;
use App\Models\User;
use Livewire\Livewire;

function agentWithKnowledge(User $user): Agent
{
    $agent = Agent::factory()->for(Project::factory()->for($user->organisation))->create(['name' => 'Shop helper']);
    $source = Source::factory()->ready()->for($agent)->create(['title' => 'Opening hours']);
    Chunk::factory()->for($source)->create(['content' => 'We open at 9.']);

    return $agent;
}

it('shows the test chat with its empty state', function () {
    $user = User::factory()->create();
    $agent = agentWithKnowledge($user);

    $this->actingAs($user)
        ->get(route('agents.test', $agent))
        ->assertOk()
        ->assertSeeLivewire(AgentTest::class)
        ->assertSeeInOrder(['Setup', 'Knowledge', 'Test', 'Share'])
        ->assertSee('Shop helper')
        ->assertSee('Ask a question to see how your assistant replies.')
        ->assertSee('Send')
        ->assertSee('Start over')
        ->assertDontSee('Add knowledge first.')
        ->assertDontSee('Based on:');
});

it('keeps people out of test chats in other workspaces', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->create();

    $this->actingAs($user)->get(route('agents.test', $agent))->assertForbidden();
});

it('asks people to add knowledge before testing when nothing is ready', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->for(Project::factory()->for($user->organisation))->create();
    Source::factory()->for($agent)->create();

    Livewire::actingAs($user)
        ->test(AgentTest::class, ['agent' => $agent])
        ->assertSee('Add knowledge first.')
        ->assertSee(route('agents.knowledge', $agent));
});

it('replies to a question and says what the reply is based on', function () {
    $user = User::factory()->create();
    $agent = agentWithKnowledge($user);

    Livewire::actingAs($user)
        ->test(AgentTest::class, ['agent' => $agent])
        ->set('message', 'When do you open?')
        ->call('send')
        ->assertHasNoErrors()
        ->assertSet('message', '')
        ->assertSeeInOrder(['You', 'When do you open?', 'Assistant', 'Fake answer about: When do you open?', 'Based on:', 'Opening hours'])
        ->assertDontSee('Ask a question to see how your assistant replies.');

    $conversation = Conversation::sole();
    expect($conversation->agent_id)->toBe($agent->id)
        ->and($conversation->organisation_id)->toBe($agent->organisation_id)
        ->and($conversation->origin)->toBe(ConversationOrigin::Test)
        ->and($conversation->embed_key_id)->toBeNull()
        ->and($conversation->messages()->count())->toBe(2);
});

it('keeps the whole transcript in one conversation', function () {
    $user = User::factory()->create();
    $agent = agentWithKnowledge($user);

    Livewire::actingAs($user)
        ->test(AgentTest::class, ['agent' => $agent])
        ->set('message', 'Hello')
        ->call('send')
        ->set('message', 'And again')
        ->call('send')
        ->assertSeeInOrder(['Hello', 'Fake answer about: Hello', 'And again', 'Fake answer about: And again']);

    expect(Conversation::count())->toBe(1)
        ->and(Conversation::sole()->messages()->count())->toBe(4);
});

it('asks for a message before sending', function () {
    $user = User::factory()->create();
    $agent = agentWithKnowledge($user);

    Livewire::actingAs($user)
        ->test(AgentTest::class, ['agent' => $agent])
        ->set('message', '   ')
        ->call('send')
        ->assertHasErrors(['message'])
        ->assertSee('Please type a message');

    expect(Conversation::count())->toBe(0);
});

it('starts over with a fresh conversation', function () {
    $user = User::factory()->create();
    $agent = agentWithKnowledge($user);

    Livewire::actingAs($user)
        ->test(AgentTest::class, ['agent' => $agent])
        ->set('message', 'Hello')
        ->call('send')
        ->call('startOver')
        ->assertSee('Ask a question to see how your assistant replies.')
        ->assertDontSee('Fake answer about: Hello')
        ->set('message', 'Second time')
        ->call('send')
        ->assertSee('Fake answer about: Second time')
        ->assertDontSee('Fake answer about: Hello');

    expect(Conversation::count())->toBe(2);
});
