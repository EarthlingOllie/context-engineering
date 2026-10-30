<?php

use App\Models\Agent;
use App\Models\Project;
use App\Models\Source;
use App\Models\User;

it('lets anyone in the workspace view and remove its knowledge', function () {
    $member = User::factory()->create();
    $agent = Agent::factory()->for(Project::factory()->for($member->organisation))->create();
    $source = Source::factory()->for($agent)->create();

    expect($member->can('view', $source))->toBeTrue()
        ->and($member->can('delete', $source))->toBeTrue();
});

it('keeps other workspaces out', function () {
    $owner = User::factory()->owner()->create();
    $source = Source::factory()->create();

    expect($owner->can('view', $source))->toBeFalse()
        ->and($owner->can('delete', $source))->toBeFalse();
});
