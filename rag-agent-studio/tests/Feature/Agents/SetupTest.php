<?php

use App\Enums\Tone;
use App\Livewire\Agents\AgentSetup;
use App\Models\Agent;
use App\Models\Project;
use App\Models\User;
use Livewire\Livewire;

it('shows the setup form filled in with the assistant’s current settings', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->for(Project::factory()->for($user->organisation))->create([
        'name' => 'Shop helper',
        'greeting' => 'Welcome to the shop!',
        'tone' => Tone::Professional,
        'instructions' => 'Help with orders and returns.',
        'fallback_message' => 'Please email us instead.',
        'accent_colour' => '#ff0000',
    ]);

    $this->actingAs($user)
        ->get(route('agents.setup', $agent))
        ->assertOk()
        ->assertSeeLivewire(AgentSetup::class)
        ->assertSeeInOrder(['Setup', 'Knowledge', 'Test', 'Share'])
        ->assertSee('Shop helper')
        ->assertSee('Draft')
        ->assertSee('Welcome to the shop!')
        ->assertSee('Help with orders and returns.')
        ->assertSee('Please email us instead.')
        ->assertSee('#ff0000')
        ->assertSeeInOrder(['Name', 'Greeting', 'Tone', 'What it helps with', 'Fallback reply', 'Colour'])
        ->assertSeeInOrder(['Friendly', 'Professional', 'Short and direct'])
        ->assertSee('Save')
        ->assertSee('Delete assistant')
        ->assertDontSee('Saved');

    Livewire::actingAs($user)
        ->test(AgentSetup::class, ['agent' => $agent])
        ->assertSet('name', 'Shop helper')
        ->assertSet('greeting', 'Welcome to the shop!')
        ->assertSet('tone', 'professional')
        ->assertSet('instructions', 'Help with orders and returns.')
        ->assertSet('fallbackMessage', 'Please email us instead.')
        ->assertSet('accentColour', '#ff0000');
});

it('keeps people out of assistants in other workspaces', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->create();

    $this->actingAs($user)->get(route('agents.setup', $agent))->assertForbidden();
});

it('saves the settings and says so', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->for(Project::factory()->for($user->organisation))->create();

    Livewire::actingAs($user)
        ->test(AgentSetup::class, ['agent' => $agent])
        ->set('name', 'Returns helper')
        ->set('greeting', 'Hello, need help with a return?')
        ->set('tone', 'concise')
        ->set('instructions', 'Only answer questions about returns.')
        ->set('fallbackMessage', 'I can only help with returns.')
        ->set('accentColour', '#00AA55')
        ->call('save')
        ->assertHasNoErrors()
        ->assertSee('Saved');

    $agent->refresh();

    expect($agent->name)->toBe('Returns helper')
        ->and($agent->greeting)->toBe('Hello, need help with a return?')
        ->and($agent->tone)->toBe(Tone::Concise)
        ->and($agent->instructions)->toBe('Only answer questions about returns.')
        ->and($agent->fallback_message)->toBe('I can only help with returns.')
        ->and($agent->accent_colour)->toBe('#00AA55');
});

it('asks for a name and a greeting before saving', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->for(Project::factory()->for($user->organisation))->create(['name' => 'Shop helper']);

    Livewire::actingAs($user)
        ->test(AgentSetup::class, ['agent' => $agent])
        ->set('name', '')
        ->set('greeting', '')
        ->call('save')
        ->assertHasErrors(['name', 'greeting'])
        ->assertSee('Please give the assistant a name')
        ->assertSee('Please add a greeting')
        ->assertDontSee('Saved');

    expect($agent->fresh()->name)->toBe('Shop helper');
});

it('rejects a tone or colour it does not understand', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->for(Project::factory()->for($user->organisation))->create();

    Livewire::actingAs($user)
        ->test(AgentSetup::class, ['agent' => $agent])
        ->set('tone', 'shouty')
        ->set('accentColour', 'blue')
        ->call('save')
        ->assertHasErrors(['tone', 'accentColour'])
        ->assertSee('Please choose a tone from the list')
        ->assertSee('Please pick a colour');
});

it('clears the saved notice when a later save fails', function () {
    $user = User::factory()->create();
    $agent = Agent::factory()->for(Project::factory()->for($user->organisation))->create();

    Livewire::actingAs($user)
        ->test(AgentSetup::class, ['agent' => $agent])
        ->call('save')
        ->assertSee('Saved')
        ->set('name', '')
        ->call('save')
        ->assertHasErrors(['name'])
        ->assertDontSee('Saved');
});

it('deletes the assistant and returns to its project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create();
    $agent = Agent::factory()->for($project)->create();

    Livewire::actingAs($user)
        ->test(AgentSetup::class, ['agent' => $agent])
        ->assertSeeHtml('wire:confirm')
        ->call('deleteAssistant')
        ->assertRedirect(route('projects.show', $project));

    expect(Agent::find($agent->id))->toBeNull();
});
