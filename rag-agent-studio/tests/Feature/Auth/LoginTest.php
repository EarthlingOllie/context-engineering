<?php

use App\Livewire\Auth\Login;
use App\Models\User;
use Livewire\Livewire;

it('shows the log-in form', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertSeeLivewire(Login::class)
        ->assertSee('Email')
        ->assertSee('Password')
        ->assertSee('Log in');
});

it('logs a teammate in and sends them to their projects', function () {
    $user = User::factory()->create(['email' => 'ada@example.com', 'password' => 'secret-password']);

    Livewire::test(Login::class)
        ->set('email', 'ada@example.com')
        ->set('password', 'secret-password')
        ->call('login')
        ->assertHasNoErrors()
        ->assertRedirect(route('projects.index'));

    expect(auth()->id())->toBe($user->id);
});

it('turns away a wrong password without saying which part was wrong', function () {
    User::factory()->create(['email' => 'ada@example.com', 'password' => 'secret-password']);

    Livewire::test(Login::class)
        ->set('email', 'ada@example.com')
        ->set('password', 'wrong-password')
        ->call('login')
        ->assertHasErrors(['email'])
        ->assertSee("We couldn't find an account with those details");

    expect(auth()->check())->toBeFalse();
});

it('asks for both fields before trying to log in', function () {
    Livewire::test(Login::class)
        ->call('login')
        ->assertHasErrors(['email', 'password'])
        ->assertSee('Please enter your email')
        ->assertSee('Please enter your password');
});

it('slows down password guessing after five wrong tries', function () {
    User::factory()->create(['email' => 'ada@example.com', 'password' => 'secret-password']);

    foreach (range(1, 5) as $attempt) {
        Livewire::test(Login::class)
            ->set('email', 'ada@example.com')
            ->set('password', 'wrong-password')
            ->call('login')
            ->assertSee("We couldn't find an account with those details");
    }

    Livewire::test(Login::class)
        ->set('email', 'ada@example.com')
        ->set('password', 'secret-password')
        ->call('login')
        ->assertHasErrors(['email'])
        ->assertSee('Too many log-in attempts. Please wait a minute and try again.')
        ->assertNoRedirect();

    expect(auth()->check())->toBeFalse();
});

it('forgets the wrong tries once the right password is entered', function () {
    User::factory()->create(['email' => 'ada@example.com', 'password' => 'secret-password']);

    foreach (range(1, 4) as $attempt) {
        Livewire::test(Login::class)->set('email', 'ada@example.com')->set('password', 'nope')->call('login');
    }

    Livewire::test(Login::class)
        ->set('email', 'ada@example.com')
        ->set('password', 'secret-password')
        ->call('login')
        ->assertHasNoErrors()
        ->assertRedirect(route('projects.index'));

    auth()->logout();

    foreach (range(1, 4) as $attempt) {
        Livewire::test(Login::class)->set('email', 'ada@example.com')->set('password', 'nope')->call('login');
    }

    Livewire::test(Login::class)
        ->set('email', 'ada@example.com')
        ->set('password', 'secret-password')
        ->call('login')
        ->assertHasNoErrors();
});

it('counts wrong tries per email, not for everyone at once', function () {
    User::factory()->create(['email' => 'ada@example.com', 'password' => 'secret-password']);
    User::factory()->create(['email' => 'grace@example.com', 'password' => 'secret-password']);

    foreach (range(1, 5) as $attempt) {
        Livewire::test(Login::class)->set('email', 'ada@example.com')->set('password', 'nope')->call('login');
    }

    Livewire::test(Login::class)
        ->set('email', 'grace@example.com')
        ->set('password', 'secret-password')
        ->call('login')
        ->assertHasNoErrors()
        ->assertRedirect(route('projects.index'));
});
