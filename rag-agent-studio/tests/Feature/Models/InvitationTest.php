<?php

use App\Models\Invitation;
use App\Models\Organisation;
use App\Models\User;

it('gets a unique 40 character token and expires in 7 days', function () {
    $organisation = Organisation::factory()->create();
    $inviter = User::factory()->owner()->for($organisation)->create();

    $invitation = Invitation::create([
        'organisation_id' => $organisation->id,
        'email' => 'new@example.com',
        'invited_by' => $inviter->id,
    ]);

    expect(strlen($invitation->token))->toBe(40)
        ->and($invitation->expires_at->toDateString())->toBe(now()->addDays(7)->toDateString())
        ->and($invitation->accepted_at)->toBeNull()
        ->and($invitation->organisation->is($organisation))->toBeTrue()
        ->and($invitation->inviter->is($inviter))->toBeTrue()
        ->and($invitation->isUsable())->toBeTrue();
});

it('is not usable once accepted', function () {
    $invitation = Invitation::factory()->accepted()->create();

    expect($invitation->accepted_at)->not->toBeNull()
        ->and($invitation->isUsable())->toBeFalse();
});

it('is not usable once expired', function () {
    $invitation = Invitation::factory()->expired()->create();

    expect($invitation->isUsable())->toBeFalse();
});

it('keeps an explicit token', function () {
    $invitation = Invitation::factory()->create(['token' => str_repeat('a', 40)]);

    expect($invitation->token)->toBe(str_repeat('a', 40));
});
