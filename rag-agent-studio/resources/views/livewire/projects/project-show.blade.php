<div>
    <p class="mb-2 text-sm"><a href="{{ route('projects.index') }}" class="text-slate-600 hover:underline">&larr; Projects</a></p>

    <div class="mb-6 flex items-center justify-between gap-4">
        @if ($renaming)
            <form wire:submit="rename" class="flex flex-1 items-start gap-3">
                <div class="flex-1">
                    <label for="project-name" class="sr-only">Project name</label>
                    <input id="project-name" type="text" wire:model="projectName" autofocus class="w-full rounded-md border border-slate-300 px-3 py-2 text-lg font-semibold">
                    @error('projectName') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
                </div>
                <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                <button type="button" wire:click="$set('renaming', false)" class="px-3 py-2 text-sm text-slate-600 hover:underline">Cancel</button>
            </form>
        @else
            <div class="flex items-center gap-3">
                <h1 class="text-2xl font-semibold">{{ $project->name }}</h1>
                <button type="button" wire:click="startRenaming" class="text-sm text-slate-600 hover:underline">Rename</button>
            </div>
        @endif
        <button type="button" wire:click="startCreatingAssistant" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            New assistant
        </button>
    </div>

    @if ($creatingAssistant)
        <form wire:submit="createAssistant" class="mb-6 flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex-1">
                <label for="assistant-name" class="sr-only">Assistant name</label>
                <input id="assistant-name" type="text" wire:model="assistantName" placeholder="Assistant name" autofocus class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                @error('assistantName') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
            </div>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Create</button>
            <button type="button" wire:click="$set('creatingAssistant', false)" class="px-3 py-2 text-sm text-slate-600 hover:underline">Cancel</button>
        </form>
    @endif

    @if ($agents->isEmpty())
        <p class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            No assistants yet. Create one to get started.
        </p>
    @else
        <ul class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            @foreach ($agents as $agent)
                <li wire:key="agent-{{ $agent->id }}">
                    <a href="{{ route('agents.setup', $agent) }}" class="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                        <span class="flex items-center gap-3">
                            <span class="font-medium">{{ $agent->name }}</span>
                            <x-badge :status="$agent->status" />
                        </span>
                        <span class="text-sm text-slate-600">{{ $agent->sources_count }} {{ Str::plural('source', $agent->sources_count) }}</span>
                    </a>
                </li>
            @endforeach
        </ul>
    @endif

    @can('delete', $project)
        <div class="mt-10 border-t border-slate-200 pt-6">
            <button type="button" wire:click="deleteProject" wire:confirm="Delete this project and all of its assistants? This can't be undone." class="text-sm text-red-700 hover:underline">
                Delete project
            </button>
        </div>
    @endcan
</div>
