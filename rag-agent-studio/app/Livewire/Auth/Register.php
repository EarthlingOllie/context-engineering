<?php

namespace App\Livewire\Auth;

use App\Enums\Role;
use App\Models\Organisation;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Create your workspace')]
class Register extends Component
{
    public string $workspaceName = '';

    public string $name = '';

    public string $email = '';

    public string $password = '';

    protected function rules(): array
    {
        return [
            'workspaceName' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ];
    }

    protected function messages(): array
    {
        return [
            'workspaceName.required' => 'Please enter a workspace name',
            'name.required' => 'Please enter your name',
            'email.required' => 'Please enter your email',
            'email.email' => 'Please enter a valid email',
            'email.unique' => 'That email is already in use',
            'password.required' => 'Please choose a password',
            'password.min' => 'Password must be at least 8 characters',
        ];
    }

    public function register()
    {
        $this->validate();

        $user = DB::transaction(function (): User {
            $organisation = Organisation::create(['name' => $this->workspaceName]);

            return $organisation->users()->create([
                'name' => $this->name,
                'email' => $this->email,
                'password' => $this->password,
                'role' => Role::Owner,
            ]);
        });

        Auth::login($user);
        session()->regenerate();

        return $this->redirectRoute('projects.index');
    }

    public function render()
    {
        return view('livewire.auth.register');
    }
}
