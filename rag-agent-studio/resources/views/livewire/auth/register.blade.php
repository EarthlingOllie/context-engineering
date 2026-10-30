<div class="mx-auto max-w-md">
    <h1 class="mb-6 text-2xl font-semibold">Create your workspace</h1>

    <form wire:submit="register" class="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
            <label for="workspaceName" class="block text-sm font-medium">Workspace name</label>
            <input id="workspaceName" type="text" wire:model="workspaceName" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
            @error('workspaceName') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="name" class="block text-sm font-medium">Your name</label>
            <input id="name" type="text" wire:model="name" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
            @error('name') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

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

        <button type="submit" class="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Create workspace</button>
    </form>

    <p class="mt-4 text-center text-sm text-slate-600">
        Already have a workspace? <a href="{{ route('login') }}" class="text-blue-700 hover:underline">Log in</a>
    </p>
</div>
