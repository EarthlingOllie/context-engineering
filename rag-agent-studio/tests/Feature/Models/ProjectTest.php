<?php

use App\Models\Agent;
use App\Models\Organisation;
use App\Models\Project;

it('belongs to a workspace and lists its assistants', function () {
    $project = Project::factory()->create(['name' => 'Support', 'description' => 'Help desk']);
    $agent = Agent::factory()->for($project)->create();

    expect($project->organisation)->toBeInstanceOf(Organisation::class)
        ->and($project->description)->toBe('Help desk')
        ->and($project->agents->pluck('id')->all())->toBe([$agent->id]);
});

it('removes its assistants when deleted', function () {
    $project = Project::factory()->create();
    Agent::factory()->for($project)->create();

    $project->delete();

    expect(Agent::count())->toBe(0);
});
