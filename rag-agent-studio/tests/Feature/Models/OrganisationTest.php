<?php

use App\Models\Invitation;
use App\Models\Organisation;
use App\Models\Project;
use App\Models\User;

it('owns its users, projects and invitations', function () {
    $organisation = Organisation::factory()->create(['name' => 'Acme']);
    $user = User::factory()->for($organisation)->create();
    $project = Project::factory()->for($organisation)->create();
    $invitation = Invitation::factory()->for($organisation)->create();

    expect($organisation->name)->toBe('Acme')
        ->and($organisation->users->pluck('id')->all())->toContain($user->id)
        ->and($organisation->projects->pluck('id')->all())->toBe([$project->id])
        ->and($organisation->invitations->pluck('id')->all())->toBe([$invitation->id]);
});

it('removes its projects, users and invitations when deleted', function () {
    $organisation = Organisation::factory()->create();
    User::factory()->for($organisation)->create();
    Project::factory()->for($organisation)->create();
    Invitation::factory()->for($organisation)->create();

    $organisation->delete();

    expect(User::count())->toBe(0)
        ->and(Project::count())->toBe(0)
        ->and(Invitation::count())->toBe(0);
});
