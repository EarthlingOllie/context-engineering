<?php

use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\User;

it('tells the invitee who invited them, where, and how to join', function () {
    $owner = User::factory()->owner()->create(['name' => 'Ada Lovelace']);
    $owner->organisation->update(['name' => 'Acme Bakery']);
    $invitation = Invitation::factory()->for($owner->organisation)->create(['invited_by' => $owner->id]);

    $mail = new InvitationMail($invitation);

    $mail->assertHasSubject("You're invited to join Acme Bakery")
        ->assertSeeInHtml('Ada Lovelace has invited you')
        ->assertSeeInHtml('Acme Bakery')
        ->assertSeeInHtml(route('invite.accept', $invitation->token))
        ->assertSeeInHtml('Join workspace')
        ->assertSeeInHtml('7 days');
});

it('still reads well when the inviter has left the workspace', function () {
    $invitation = Invitation::factory()->create(['invited_by' => null]);
    $invitation->organisation->update(['name' => 'Acme Bakery']);

    (new InvitationMail($invitation->fresh()))
        ->assertSeeInHtml("You've been invited to join", false)
        ->assertSeeInHtml('Acme Bakery');
});
