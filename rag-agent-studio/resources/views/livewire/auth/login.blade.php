<div class="mx-auto max-w-md">
    <h1 class="mb-6 text-2xl font-semibold">Log in</h1>

    <form wire:submit="login" class="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
            <label for="email" class="block text-sm font-medium">Email</label>
            <input id="email" type="email" wire:model="email" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
            @error('email') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="password" class="block text-sm font-medium">Password</label>
            <input id="password" type="password" wire:model="password" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
            @error('password') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <button type="submit" class="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Log in</button>
    </form>

    <p class="mt-4 text-center text-sm text-slate-600">
        New here? <a href="{{ route('register') }}" class="text-blue-700 hover:underline">Create a workspace</a>
    </p>
</div>
