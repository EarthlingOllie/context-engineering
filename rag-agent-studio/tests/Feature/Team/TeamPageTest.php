<?php

use App\Livewire\Team\TeamPage;
use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;

it('lists every teammate with their name, email and role', function () {
    $owner = User::factory()->owner()->create(['name' => 'Ada Lovelace', 'email' => 'ada@example.com']);
    User::factory()->for($owner->organisation)->create(['name' => 'Grace Hopper', 'email' => 'grace@example.com']);

    $this->actingAs($owner)
        ->get(route('team'))
        ->assertOk()
        ->assertSeeLivewire(TeamPage::class)
        ->assertSeeInOrder(['Ada Lovelace', 'ada@example.com', 'Owner', 'Grace Hopper', 'grace@example.com', 'Member'])
        ->assertDontSee("You're the only member so far.");
});

it('tells a lone owner they are the only member so far', function () {
    $owner = User::factory()->owner()->create();

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->assertSee("You're the only member so far.");
});

it('only shows teammates from the same workspace', function () {
    $owner = User::factory()->owner()->create();
    User::factory()->create(['name' => 'Someone Elsewhere']);

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->assertDontSee('Someone Elsewhere');
});

it('lets the owner invite a teammate, shows the link and emails it', function () {
    Mail::fake();
    $owner = User::factory()->owner()->create();

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->set('email', 'grace@example.com')
        ->call('invite')
        ->assertHasNoErrors()
        ->assertSet('email', '');

    $invitation = Invitation::firstWhere('email', 'grace@example.com');

    expect($invitation)->not->toBeNull()
        ->and($invitation->organisation_id)->toBe($owner->organisation_id)
        ->and($invitation->invited_by)->toBe($owner->id)
        ->and($invitation->isUsable())->toBeTrue();

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->assertSee('grace@example.com')
        ->assertSee(route('invite.accept', $invitation->token))
        ->assertSee('Cancel');

    Mail::assertSent(InvitationMail::class, fn (InvitationMail $mail) => $mail->hasTo('grace@example.com')
        && $mail->invitation->is($invitation));
});

it('asks for a valid email before inviting', function () {
    Mail::fake();
    $owner = User::factory()->owner()->create();

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->set('email', 'not-an-email')
        ->call('invite')
        ->assertHasErrors(['email'])
        ->assertSee('Please enter a valid email');

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->set('email', '')
        ->call('invite')
        ->assertHasErrors(['email'])
        ->assertSee('Please enter a valid email');

    expect(Invitation::count())->toBe(0);
    Mail::assertNothingSent();
});

it('will not invite someone who is already in the workspace', function () {
    Mail::fake();
    $owner = User::factory()->owner()->create();
    User::factory()->for($owner->organisation)->create(['email' => 'grace@example.com']);

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->set('email', 'grace@example.com')
        ->call('invite')
        ->assertHasErrors(['email'])
        ->assertSee('That person is already in your workspace');

    expect(Invitation::count())->toBe(0);
});

it('lets the owner cancel a pending invitation', function () {
    $owner = User::factory()->owner()->create();
    $invitation = Invitation::factory()->for($owner->organisation)->create(['invited_by' => $owner->id]);

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->assertSee($invitation->email)
        ->call('cancel', $invitation->id)
        ->assertDontSee($invitation->email);

    expect(Invitation::find($invitation->id))->toBeNull();
});

it('hides used and expired invitations', function () {
    $owner = User::factory()->owner()->create();
    Invitation::factory()->for($owner->organisation)->accepted()->create(['email' => 'used@example.com', 'invited_by' => $owner->id]);
    Invitation::factory()->for($owner->organisation)->expired()->create(['email' => 'late@example.com', 'invited_by' => $owner->id]);

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->assertDontSee('used@example.com')
        ->assertDontSee('late@example.com')
        ->assertDontSee('Pending invitations');
});

it('lets the owner remove a teammate but not themselves', function () {
    $owner = User::factory()->owner()->create();
    $member = User::factory()->for($owner->organisation)->create(['name' => 'Grace Hopper']);

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->assertSeeHtml('wire:click="remove('.$member->id.')"')
        ->assertDontSeeHtml('wire:click="remove('.$owner->id.')"')
        ->call('remove', $member->id)
        ->assertDontSee('Grace Hopper');

    expect(User::find($member->id))->toBeNull();

    Livewire::actingAs($owner)
        ->test(TeamPage::class)
        ->call('remove', $owner->id)
        ->assertForbidden();

    expect(User::find($owner->id))->not->toBeNull();
});

it('keeps members from inviting, removing or cancelling', function () {
    Mail::fake();
    $owner = User::factory()->owner()->create();
    $member = User::factory()->for($owner->organisation)->create();
    $invitation = Invitation::factory()->for($owner->organisation)->create(['invited_by' => $owner->id]);

    Livewire::actingAs($member)
        ->test(TeamPage::class)
        ->assertDontSee('Invite')
        ->assertDontSee('Remove')
        ->assertDontSee('Cancel');

    Livewire::actingAs($member)->test(TeamPage::class)->set('email', 'new@example.com')->call('invite')->assertForbidden();
    Livewire::actingAs($member)->test(TeamPage::class)->call('remove', $owner->id)->assertForbidden();
    Livewire::actingAs($member)->test(TeamPage::class)->call('cancel', $invitation->id)->assertForbidden();

    expect(User::find($owner->id))->not->toBeNull()
        ->and(Invitation::find($invitation->id))->not->toBeNull()
        ->and(Invitation::where('email', 'new@example.com')->exists())->toBeFalse();
});

it('cannot touch people or invitations from another workspace', function () {
    $owner = User::factory()->owner()->create();
    $stranger = User::factory()->create();
    $otherInvitation = Invitation::factory()->create();

    expect(fn () => Livewire::actingAs($owner)->test(TeamPage::class)->call('remove', $stranger->id))
        ->toThrow(ModelNotFoundException::class);

    expect(fn () => Livewire::actingAs($owner)->test(TeamPage::class)->call('cancel', $otherInvitation->id))
        ->toThrow(ModelNotFoundException::class);

    expect(User::find($stranger->id))->not->toBeNull()
        ->and(Invitation::find($otherInvitation->id))->not->toBeNull();
});
