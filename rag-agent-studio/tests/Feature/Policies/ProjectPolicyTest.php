<?php

use App\Models\Project;
use App\Models\User;

it('lets members view and update projects in their workspace', function () {
    $member = User::factory()->create();
    $project = Project::factory()->for($member->organisation)->create();

    expect($member->can('view', $project))->toBeTrue()
        ->and($member->can('update', $project))->toBeTrue()
        ->and($member->can('delete', $project))->toBeFalse();
});

it('lets owners delete projects in their workspace', function () {
    $owner = User::factory()->owner()->create();
    $project = Project::factory()->for($owner->organisation)->create();

    expect($owner->can('delete', $project))->toBeTrue();
});

it('keeps other workspaces out', function () {
    $owner = User::factory()->owner()->create();
    $project = Project::factory()->create();

    expect($owner->can('view', $project))->toBeFalse()
        ->and($owner->can('update', $project))->toBeFalse()
        ->and($owner->can('delete', $project))->toBeFalse();
});
