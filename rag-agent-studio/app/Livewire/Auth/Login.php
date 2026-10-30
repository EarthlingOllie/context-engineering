<?php

namespace App\Livewire\Auth;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Log in')]
class Login extends Component
{
    public string $email = '';

    public string $password = '';

    protected function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    protected function messages(): array
    {
        return [
            'email.required' => 'Please enter your email',
            'email.email' => 'Please enter a valid email',
            'password.required' => 'Please enter your password',
        ];
    }

    public function login()
    {
        $this->validate();

        // Five wrong tries a minute per email and address, so passwords cannot be guessed
        $throttleKey = 'login|'.Str::lower($this->email).'|'.request()->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            throw ValidationException::withMessages([
                'email' => 'Too many log-in attempts. Please wait a minute and try again.',
            ]);
        }

        if (! Auth::attempt(['email' => $this->email, 'password' => $this->password])) {
            RateLimiter::hit($throttleKey, 60);

            throw ValidationException::withMessages([
                'email' => "We couldn't find an account with those details",
            ]);
        }

        RateLimiter::clear($throttleKey);
        session()->regenerate();

        return $this->redirectRoute('projects.index');
    }

    public function render()
    {
        return view('livewire.auth.login');
    }
}
