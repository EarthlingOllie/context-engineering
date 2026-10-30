<?php

use App\Livewire\Auth\AcceptInvite;
use App\Livewire\Auth\Login;
use App\Livewire\Auth\Register;
use App\Livewire\Team\TeamPage;
use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\User;
use Livewire\Livewire;

$bannedWords = ['token', 'chunk', 'embedding', 'model', 'temperature', 'api key', 'agent', 'bot', 'corpus', 'rag', 'tenant', 'org ', 'users', 'roles'];

it('never shows technical words on the sign-up, log-in, invitation and team pages', function () use ($bannedWords) {
    $owner = User::factory()->owner()->create();
    User::factory()->for($owner->organisation)->create();
    $invitation = Invitation::factory()->for($owner->organisation)->create(['invited_by' => $owner->id]);

    $pages = [
        Livewire::test(Register::class)->html(),
        Livewire::test(Login::class)->html(),
        Livewire::test(AcceptInvite::class, ['token' => $invitation->token])->html(),
        Livewire::test(AcceptInvite::class, ['token' => Invitation::factory()->expired()->create()->token])->html(),
        Livewire::actingAs($owner)->test(TeamPage::class)->html(),
        (new InvitationMail($invitation))->render(),
    ];

    foreach ($pages as $html) {
        $text = strtolower(strip_tags($html));

        foreach ($bannedWords as $word) {
            expect(preg_match('/\b'.preg_quote($word, '/').'\b/', $text))->toBe(0, "'{$word}' appears on a page");
        }
    }
});
