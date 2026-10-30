<div class="mx-auto max-w-md">
    <h1 class="mb-2 text-2xl font-semibold">Join {{ $workspaceName }}</h1>

    @if ($usable)
        <p class="mb-6 text-sm text-slate-600">You've been invited to the <strong>{{ $workspaceName }}</strong> workspace. Tell us your name and choose a password to join.</p>

        <form wire:submit="join" class="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div>
                <label for="name" class="block text-sm font-medium">Your name</label>
                <input id="name" type="text" wire:model="name" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
                @error('name') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
            </div>

            <div>
                <label for="password" class="block text-sm font-medium">Password</label>
                <input id="password" type="password" wire:model="password" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
                @error('password') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
            </div>

            <button type="submit" class="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Join workspace</button>
        </form>
    @else
        <div class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <p>This invitation has expired or was already used.</p>
            <p class="mt-2 text-sm">Ask the person who invited you to send a new one.</p>
        </div>
    @endif

    <p class="mt-4 text-center text-sm text-slate-600">
        Already a member? <a href="{{ route('login') }}" class="text-blue-700 hover:underline">Log in</a>
    </p>
</div>
