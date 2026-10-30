<div>
    <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-semibold">Projects</h1>
        <button type="button" wire:click="startCreating" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            New project
        </button>
    </div>

    @if ($creating)
        <form wire:submit="create" class="mb-6 flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex-1">
                <label for="project-name" class="sr-only">Project name</label>
                <input id="project-name" type="text" wire:model="name" placeholder="Project name" autofocus class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                @error('name') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
            </div>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Create</button>
            <button type="button" wire:click="$set('creating', false)" class="px-3 py-2 text-sm text-slate-600 hover:underline">Cancel</button>
        </form>
    @endif

    @if ($projects->isEmpty())
        <p class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            Create your first project to start building assistants.
        </p>
    @else
        <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @foreach ($projects as $project)
                <li wire:key="project-{{ $project->id }}">
                    <a href="{{ route('projects.show', $project) }}" class="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-400">
                        <h2 class="font-semibold">{{ $project->name }}</h2>
                        <p class="mt-1 text-sm text-slate-600">{{ $project->agents_count }} {{ Str::plural('assistant', $project->agents_count) }}</p>
                    </a>
                </li>
            @endforeach
        </ul>
    @endif
</div>
