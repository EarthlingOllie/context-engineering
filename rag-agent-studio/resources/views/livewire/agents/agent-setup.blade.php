<div>
    <p class="mb-2 text-sm"><a href="{{ route('projects.show', $agent->project) }}" class="text-slate-600 hover:underline">&larr; {{ $agent->project->name }}</a></p>

    <div class="mb-4 flex items-center gap-3">
        <h1 class="text-2xl font-semibold">{{ $agent->name }}</h1>
        <x-badge :status="$agent->status" />
    </div>

    <x-agent-tabs :agent="$agent" />

    <form wire:submit="save" class="max-w-2xl space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
            <label for="name" class="block text-sm font-medium">Name</label>
            <input id="name" type="text" wire:model="name" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            @error('name') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="greeting" class="block text-sm font-medium">Greeting</label>
            <p class="text-xs text-slate-500">The first thing people see when they open a chat.</p>
            <input id="greeting" type="text" wire:model="greeting" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            @error('greeting') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="tone" class="block text-sm font-medium">Tone</label>
            <select id="tone" wire:model="tone" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                @foreach ($tones as $option)
                    <option value="{{ $option->value }}">{{ $option->label() }}</option>
                @endforeach
            </select>
            @error('tone') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="instructions" class="block text-sm font-medium">What it helps with</label>
            <p class="text-xs text-slate-500">Describe what your assistant should help people with, in your own words.</p>
            <textarea id="instructions" rows="4" wire:model="instructions" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"></textarea>
        </div>

        <div>
            <label for="fallback-message" class="block text-sm font-medium">Fallback reply</label>
            <p class="text-xs text-slate-500">What your assistant says when it doesn't know the answer.</p>
            <input id="fallback-message" type="text" wire:model="fallbackMessage" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            @error('fallbackMessage') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="accent-colour" class="block text-sm font-medium">Colour</label>
            <div class="mt-1 flex items-center gap-3">
                <input id="accent-colour" type="color" wire:model="accentColour" class="h-9 w-12 rounded border border-slate-300">
                <span class="text-sm text-slate-600">{{ $accentColour }}</span>
            </div>
            @error('accentColour') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
        </div>

        <div class="flex items-center gap-4">
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
            @if ($saved)
                <span class="text-sm text-green-700" role="status">Saved</span>
            @endif
        </div>
    </form>

    <div class="mt-10 border-t border-slate-200 pt-6">
        <button type="button" wire:click="deleteAssistant" wire:confirm="Delete this assistant and everything it knows? This can't be undone." class="text-sm text-red-700 hover:underline">
            Delete assistant
        </button>
    </div>
</div>
