<?php

use App\Enums\Role;
use App\Models\Organisation;
use App\Models\User;

it('belongs to a workspace and defaults to the member role', function () {
    $user = User::factory()->create();

    expect($user->organisation)->toBeInstanceOf(Organisation::class)
        ->and($user->role)->toBe(Role::Member)
        ->and($user->isOwner())->toBeFalse();
});

it('can be made an owner', function () {
    $owner = User::factory()->owner()->create();

    expect($owner->role)->toBe(Role::Owner)
        ->and($owner->isOwner())->toBeTrue();
});

it('hashes its password', function () {
    $user = User::factory()->create(['password' => 'secret-123']);

    expect($user->password)->not->toBe('secret-123')
        ->and(password_verify('secret-123', $user->password))->toBeTrue();
});
