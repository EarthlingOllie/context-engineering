<?php

use App\Models\Organisation;
use App\Models\User;

it('lets an owner manage their own workspace team', function () {
    $owner = User::factory()->owner()->create();

    expect($owner->can('manageTeam', $owner->organisation))->toBeTrue();
});

it('stops a member managing the team', function () {
    $member = User::factory()->create();

    expect($member->can('manageTeam', $member->organisation))->toBeFalse();
});

it('stops an owner managing another workspace', function () {
    $owner = User::factory()->owner()->create();
    $other = Organisation::factory()->create();

    expect($owner->can('manageTeam', $other))->toBeFalse();
});
