<?php

use App\Enums\Role;
use App\Livewire\Auth\AcceptInvite;
use App\Models\Invitation;
use App\Models\User;
use Livewire\Livewire;

it('shows the workspace name and the join form for a valid invitation', function () {
    $invitation = Invitation::factory()->create();
    $invitation->organisation->update(['name' => 'Acme Bakery']);

    $this->get(route('invite.accept', $invitation->token))
        ->assertOk()
        ->assertSeeLivewire(AcceptInvite::class)
        ->assertSee('Acme Bakery')
        ->assertSee('Your name')
        ->assertSee('Password')
        ->assertSee('Join workspace');
});

it('creates a member, marks the invitation used and logs them in', function () {
    $invitation = Invitation::factory()->create(['email' => 'grace@example.com']);

    Livewire::test(AcceptInvite::class, ['token' => $invitation->token])
        ->set('name', 'Grace Hopper')
        ->set('password', 'secret-password')
        ->call('join')
        ->assertHasNoErrors()
        ->assertRedirect(route('projects.index'));

    $user = User::firstWhere('email', 'grace@example.com');

    expect($user)->not->toBeNull()
        ->and($user->name)->toBe('Grace Hopper')
        ->and($user->role)->toBe(Role::Member)
        ->and($user->organisation_id)->toBe($invitation->organisation_id)
        ->and(auth()->id())->toBe($user->id)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();
});

it('tells the visitor when the invitation has expired', function () {
    $invitation = Invitation::factory()->expired()->create();

    $this->get(route('invite.accept', $invitation->token))
        ->assertOk()
        ->assertSee('This invitation has expired or was already used')
        ->assertDontSee('Join workspace');
});

it('tells the visitor when the invitation was already used', function () {
    $invitation = Invitation::factory()->accepted()->create();

    Livewire::test(AcceptInvite::class, ['token' => $invitation->token])
        ->assertSee('This invitation has expired or was already used')
        ->set('name', 'Grace')
        ->set('password', 'secret-password')
        ->call('join')
        ->assertNoRedirect();

    expect(User::where('email', $invitation->email)->exists())->toBeFalse();
});

it('cannot be opened with an unknown link', function () {
    $this->get(route('invite.accept', 'no-such-token'))->assertNotFound();
});

it('asks for a name and a password of at least 8 characters', function () {
    $invitation = Invitation::factory()->create();

    Livewire::test(AcceptInvite::class, ['token' => $invitation->token])
        ->set('name', '')
        ->set('password', 'short')
        ->call('join')
        ->assertHasErrors(['name', 'password'])
        ->assertSee('Please enter your name')
        ->assertSee('Password must be at least 8 characters');
});

it('will not create a second account for an email that already has one', function () {
    User::factory()->create(['email' => 'grace@example.com']);
    $invitation = Invitation::factory()->create(['email' => 'grace@example.com']);

    Livewire::test(AcceptInvite::class, ['token' => $invitation->token])
        ->set('name', 'Grace Hopper')
        ->set('password', 'secret-password')
        ->call('join')
        ->assertHasErrors(['name'])
        ->assertSee('That email is already in use');

    expect(User::where('email', 'grace@example.com')->count())->toBe(1)
        ->and($invitation->fresh()->accepted_at)->toBeNull();
});
