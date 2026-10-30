<?php

use App\Livewire\Projects\ProjectList;
use App\Models\Agent;
use App\Models\Project;
use App\Models\User;
use Livewire\Livewire;

it('shows the empty state when the workspace has no projects', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('projects.index'))
        ->assertOk()
        ->assertSeeLivewire(ProjectList::class)
        ->assertSee('Create your first project to start building assistants.')
        ->assertSee('New project');
});

it('lists the workspace projects as cards with their assistant count', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create(['name' => 'Customer help']);
    Agent::factory()->count(2)->for($project)->create();
    Project::factory()->create(['name' => 'Someone else’s project']);

    $this->actingAs($user)
        ->get(route('projects.index'))
        ->assertSee('Customer help')
        ->assertSee('2 assistants')
        ->assertSee(route('projects.show', $project), false)
        ->assertDontSee('Someone else’s project')
        ->assertDontSee('Create your first project');
});

it('uses the singular when a project has one assistant', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user->organisation)->create();
    Agent::factory()->for($project)->create();

    Livewire::actingAs($user)->test(ProjectList::class)->assertSee('1 assistant');
});

it('creates a project from the inline form and shows it as a card', function () {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(ProjectList::class)
        ->assertSet('creating', false)
        ->call('startCreating')
        ->assertSet('creating', true)
        ->assertSee('Create')
        ->set('name', 'Customer help')
        ->call('create')
        ->assertHasNoErrors()
        ->assertSet('creating', false)
        ->assertSet('name', '')
        ->assertSee('Customer help');

    expect($user->organisation->projects()->where('name', 'Customer help')->exists())->toBeTrue();
});

it('asks for a name before creating a project', function () {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(ProjectList::class)
        ->call('startCreating')
        ->set('name', '')
        ->call('create')
        ->assertHasErrors(['name'])
        ->assertSee('Please give the project a name');

    expect(Project::count())->toBe(0);
});
