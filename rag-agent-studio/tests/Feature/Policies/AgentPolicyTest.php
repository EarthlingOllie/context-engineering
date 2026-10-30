<?php

use App\Models\Agent;
use App\Models\Project;
use App\Models\User;

it('lets anyone in the workspace view, update and delete its assistants', function () {
    $member = User::factory()->create();
    $agent = Agent::factory()->for(Project::factory()->for($member->organisation))->create();

    expect($member->can('view', $agent))->toBeTrue()
        ->and($member->can('update', $agent))->toBeTrue()
        ->and($member->can('delete', $agent))->toBeTrue();
});

it('keeps other workspaces out', function () {
    $owner = User::factory()->owner()->create();
    $agent = Agent::factory()->create();

    expect($owner->can('view', $agent))->toBeFalse()
        ->and($owner->can('update', $agent))->toBeFalse()
        ->and($owner->can('delete', $agent))->toBeFalse();
});
