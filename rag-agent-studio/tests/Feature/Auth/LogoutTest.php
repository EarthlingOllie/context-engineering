<?php

use App\Models\User;

it('logs the teammate out and returns them to the log-in page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('logout'))
        ->assertRedirect(route('login'));

    expect(auth()->check())->toBeFalse();

    $this->get(route('projects.index'))->assertRedirect(route('login'));
});
