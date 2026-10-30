<?php

use App\Enums\AgentStatus;
use App\Livewire\Projects\ProjectShow;
use App\Models\Agent;
use App\Models\Project;
use App\Models\Source;
use App\Models\User;
use Livewire\Livewire;

it('shows the project with an empty state when it has no assistants', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create(['name' => 'Customer help']);

    $this->actingAs($user)
        ->get(route('projects.show', $project))
        ->assertOk()
        ->assertSeeLivewire(ProjectShow::class)
        ->assertSee('Customer help')
        ->assertSee('No assistants yet. Create one to get started.')
        ->assertSee('New assistant');
});

it('keeps people out of projects in other workspaces', function () {
    $user = User::factory()->create();
    $project = Project::factory()->create();

    $this->actingAs($user)->get(route('projects.show', $project))->assertForbidden();
});

it('lists each assistant with its badge and source count, linking to its setup', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create();
    $draft = Agent::factory()->for($project)->create(['name' => 'Shop helper']);
    $live = Agent::factory()->for($project)->published()->create(['name' => 'Support helper']);
    Source::factory()->count(2)->for($live)->create();
    Agent::factory()->create(['name' => 'Assistant elsewhere']);

    $this->actingAs($user)
        ->get(route('projects.show', $project))
        ->assertSeeInOrder(['Shop helper', 'Draft', '0 sources', 'Support helper', 'Live', '2 sources'])
        ->assertSee(route('agents.setup', $draft), false)
        ->assertSee(route('agents.setup', $live), false)
        ->assertDontSee('Assistant elsewhere')
        ->assertDontSee('No assistants yet');
});

it('uses the singular when an assistant has one source', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create();
    Source::factory()->for(Agent::factory()->for($project))->create();

    Livewire::actingAs($user)->test(ProjectShow::class, ['project' => $project])->assertSee('1 source');
});

it('creates an assistant from a name and opens its setup', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create();

    Livewire::actingAs($user)
        ->test(ProjectShow::class, ['project' => $project])
        ->assertSet('creatingAssistant', false)
        ->call('startCreatingAssistant')
        ->assertSet('creatingAssistant', true)
        ->set('assistantName', 'Shop helper')
        ->call('createAssistant')
        ->assertHasNoErrors()
        ->assertRedirect(route('agents.setup', $project->agents()->first()));

    $agent = $project->agents()->first();

    expect($agent->name)->toBe('Shop helper')
        ->and($agent->organisation_id)->toBe($user->organisation_id)
        ->and($agent->status)->toBe(AgentStatus::Draft);
});

it('asks for a name before creating an assistant', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create();

    Livewire::actingAs($user)
        ->test(ProjectShow::class, ['project' => $project])
        ->call('startCreatingAssistant')
        ->set('assistantName', '')
        ->call('createAssistant')
        ->assertHasErrors(['assistantName'])
        ->assertSee('Please give the assistant a name');

    expect(Agent::count())->toBe(0);
});

it('renames the project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create(['name' => 'Old name']);

    Livewire::actingAs($user)
        ->test(ProjectShow::class, ['project' => $project])
        ->assertSee('Rename')
        ->assertSet('renaming', false)
        ->call('startRenaming')
        ->assertSet('renaming', true)
        ->assertSet('projectName', 'Old name')
        ->set('projectName', 'New name')
        ->call('rename')
        ->assertHasNoErrors()
        ->assertSet('renaming', false)
        ->assertSee('New name');

    expect($project->fresh()->name)->toBe('New name');
});

it('asks for a name before renaming the project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create(['name' => 'Old name']);

    Livewire::actingAs($user)
        ->test(ProjectShow::class, ['project' => $project])
        ->call('startRenaming')
        ->set('projectName', '  ')
        ->call('rename')
        ->assertHasErrors(['projectName'])
        ->assertSee('Please give the project a name');

    expect($project->fresh()->name)->toBe('Old name');
});

it('lets the owner delete the project and everything in it', function () {
    $owner = User::factory()->owner()->create();
    $project = Project::factory()->for($owner->organisation)->create();
    $agent = Agent::factory()->for($project)->create();

    Livewire::actingAs($owner)
        ->test(ProjectShow::class, ['project' => $project])
        ->assertSee('Delete project')
        ->assertSeeHtml('wire:confirm')
        ->call('deleteProject')
        ->assertRedirect(route('projects.index'));

    expect(Project::find($project->id))->toBeNull()
        ->and(Agent::find($agent->id))->toBeNull();
});

it('does not let members delete the project', function () {
    $member = User::factory()->create();
    $project = Project::factory()->for($member->organisation)->create();

    Livewire::actingAs($member)
        ->test(ProjectShow::class, ['project' => $project])
        ->assertDontSee('Delete project')
        ->call('deleteProject')
        ->assertForbidden();

    expect(Project::find($project->id))->not->toBeNull();
});
