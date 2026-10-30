<?php

namespace App\Livewire\Auth;

use App\Enums\Role;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Invitation')]
class AcceptInvite extends Component
{
    #[Locked]
    public string $token = '';

    public string $name = '';

    public string $password = '';

    public function mount(string $token): void
    {
        $this->token = $token;

        Invitation::where('token', $token)->firstOrFail();
    }

    protected function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
        ];
    }

    protected function messages(): array
    {
        return [
            'name.required' => 'Please enter your name',
            'password.required' => 'Please choose a password',
            'password.min' => 'Password must be at least 8 characters',
        ];
    }

    public function join()
    {
        $invitation = $this->invitation();

        // The page explains both of these instead of showing the form
        if (! $invitation->isUsable() || $this->emailHasAccount($invitation)) {
            return null;
        }

        $this->validate();

        $user = DB::transaction(function () use ($invitation): User {
            $invitation->update(['accepted_at' => now()]);

            return $invitation->organisation->users()->create([
                'name' => $this->name,
                'email' => $invitation->email,
                'password' => $this->password,
                'role' => Role::Member,
            ]);
        });

        Auth::login($user);
        session()->regenerate();

        return $this->redirectRoute('projects.index');
    }

    private function emailHasAccount(Invitation $invitation): bool
    {
        return User::where('email', $invitation->email)->exists();
    }

    private function invitation(): Invitation
    {
        return Invitation::with('organisation')->where('token', $this->token)->firstOrFail();
    }

    public function render()
    {
        $invitation = $this->invitation();

        return view('livewire.auth.accept-invite', [
            'workspaceName' => $invitation->organisation->name,
            'usable' => $invitation->isUsable(),
            'email' => $invitation->email,
            'emailHasAccount' => $this->emailHasAccount($invitation),
            'inviterName' => $invitation->inviter?->name,
        ]);
    }
}
