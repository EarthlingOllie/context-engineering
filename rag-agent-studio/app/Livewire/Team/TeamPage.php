<?php

namespace App\Livewire\Team;

use App\Mail\InvitationMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Team')]
class TeamPage extends Component
{
    public string $email = '';

    /** The address just invited, so the page can say what happened next. */
    public string $invitedEmail = '';

    protected function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255'],
        ];
    }

    protected function messages(): array
    {
        return [
            'email.required' => 'Please enter a valid email',
            'email.email' => 'Please enter a valid email',
        ];
    }

    public function invite(): void
    {
        $organisation = auth()->user()->organisation;

        $this->authorize('manageTeam', $organisation);

        $this->validate();

        if ($organisation->users()->where('email', $this->email)->exists()) {
            throw ValidationException::withMessages([
                'email' => 'That person is already in your workspace',
            ]);
        }

        $invitation = $organisation->invitations()->create([
            'email' => $this->email,
            'invited_by' => auth()->id(),
        ]);

        Mail::to($invitation->email)->send(new InvitationMail($invitation));

        $this->invitedEmail = $invitation->email;
        $this->email = '';
    }

    public function remove(int $userId): void
    {
        $organisation = auth()->user()->organisation;

        $this->authorize('manageTeam', $organisation);

        abort_if($userId === auth()->id(), 403, 'You cannot remove yourself from your own workspace.');

        $organisation->users()->findOrFail($userId)->delete();
    }

    public function cancel(int $invitationId): void
    {
        $organisation = auth()->user()->organisation;

        $this->authorize('manageTeam', $organisation);

        $organisation->invitations()->findOrFail($invitationId)->delete();
    }

    public function render()
    {
        $user = auth()->user();
        $organisation = $user->organisation;

        return view('livewire.team.team-page', [
            'members' => $organisation->users()->orderBy('id')->get(),
            'invitations' => $organisation->invitations()
                ->whereNull('accepted_at')
                ->where('expires_at', '>', now())
                ->orderBy('id')
                ->get(),
            'canManage' => $user->can('manageTeam', $organisation),
        ]);
    }
}
