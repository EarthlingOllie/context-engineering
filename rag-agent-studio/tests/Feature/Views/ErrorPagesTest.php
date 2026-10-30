<?php

use App\Models\Agent;
use App\Models\Project;
use App\Models\User;

it('shows a friendly page instead of a bare 404 for a chat link that no longer works', function () {
    $this->get(route('chat.show', 'an-old-key'))
        ->assertNotFound()
        ->assertSee("We couldn't find that page")
        ->assertSee('The link may be out of date')
        ->assertSee('ask them for a new one')
        ->assertDontSee('NOT FOUND')
        ->assertSee(route('login'));
});

it('shows the same friendly page for a mistyped invitation link', function () {
    $this->get(route('invite.accept', 'mistyped'))
        ->assertNotFound()
        ->assertSee("We couldn't find that page");
});

it('shows a friendly page instead of a bare 403 for another workspace\'s project', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('projects.show', Project::factory()->create()))
        ->assertForbidden()
        ->assertSee("You don't have access to that page")
        ->assertSee("It belongs to a different workspace, or you're not allowed to do that")
        ->assertDontSee('FORBIDDEN')
        ->assertSee('Go to your projects')
        ->assertSee(route('projects.index'));

    $this->actingAs($user)
        ->get(route('agents.setup', Agent::factory()->create()))
        ->assertForbidden()
        ->assertSee("You don't have access to that page");
});

it('sends a logged-in person home from the not-found page', function () {
    $this->actingAs(User::factory()->create())
        ->get('/no-such-page')
        ->assertNotFound()
        ->assertSee('Go to your projects')
        ->assertDontSee('Log in');
});

it('never shows technical words on the error pages', function () {
    $pages = [
        $this->get('/no-such-page')->getContent(),
        $this->actingAs(User::factory()->create())->get(route('projects.show', Project::factory()->create()))->getContent(),
    ];

    foreach ($pages as $html) {
        $text = strtolower(strip_tags($html));

        foreach (['404', '403', 'exception', 'http', 'error', 'forbidden', 'whoops'] as $word) {
            expect(preg_match('/\b'.preg_quote($word, '/').'\b/', $text))->toBe(0, "'{$word}' appears on an error page");
        }
    }
});
