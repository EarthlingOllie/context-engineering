<?php

use App\Enums\Role;
use App\Livewire\Auth\Register;
use App\Models\Organisation;
use App\Models\User;
use Livewire\Livewire;

it('shows the sign-up form', function () {
    $this->get(route('register'))
        ->assertOk()
        ->assertSeeLivewire(Register::class)
        ->assertSee('Workspace name')
        ->assertSee('Your name')
        ->assertSee('Email')
        ->assertSee('Password')
        ->assertSee('Create workspace');
});

it('creates a workspace with its owner and logs them in', function () {
    Livewire::test(Register::class)
        ->set('workspaceName', 'Acme Bakery')
        ->set('name', 'Ada Lovelace')
        ->set('email', 'ada@example.com')
        ->set('password', 'secret-password')
        ->call('register')
        ->assertHasNoErrors()
        ->assertRedirect(route('projects.index'));

    $organisation = Organisation::firstWhere('name', 'Acme Bakery');
    $user = User::firstWhere('email', 'ada@example.com');

    expect($organisation)->not->toBeNull()
        ->and($user->organisation_id)->toBe($organisation->id)
        ->and($user->name)->toBe('Ada Lovelace')
        ->and($user->role)->toBe(Role::Owner)
        ->and(auth()->id())->toBe($user->id);
});

it('explains what is missing in plain words', function () {
    Livewire::test(Register::class)
        ->set('workspaceName', '')
        ->set('name', '')
        ->set('email', 'not-an-email')
        ->set('password', 'short')
        ->call('register')
        ->assertHasErrors(['workspaceName', 'name', 'email', 'password'])
        ->assertSee('Please enter a workspace name')
        ->assertSee('Please enter your name')
        ->assertSee('Please enter a valid email')
        ->assertSee('Password must be at least 8 characters');

    expect(Organisation::count())->toBe(0)
        ->and(User::count())->toBe(0);
});

it('rejects an email that already belongs to someone', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    Livewire::test(Register::class)
        ->set('workspaceName', 'Acme')
        ->set('name', 'Ada')
        ->set('email', 'taken@example.com')
        ->set('password', 'secret-password')
        ->call('register')
        ->assertHasErrors(['email'])
        ->assertSee('That email is already in use');
});

it('asks for an email and a password when they are blank', function () {
    Livewire::test(Register::class)
        ->set('workspaceName', 'Acme')
        ->set('name', 'Ada')
        ->call('register')
        ->assertSee('Please enter your email')
        ->assertSee('Please choose a password');
});
