<div>
    <p class="mb-2 text-sm"><a href="{{ route('projects.show', $agent->project) }}" class="text-slate-600 hover:underline">&larr; {{ $agent->project->name }}</a></p>

    <div class="mb-4 flex items-center gap-3">
        <h1 class="text-2xl font-semibold">{{ $agent->name }}</h1>
        <x-badge :status="$agent->status" />
    </div>

    <x-agent-tabs :agent="$agent" />

    <div class="grid gap-6 lg:grid-cols-3">
        <section class="space-y-4 lg:col-span-1">
            <form wire:submit="uploadFile" class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                <h2 class="font-medium">Upload file</h2>
                <p class="text-xs text-slate-500">PDF, Word, text or Markdown, up to 10 MB.</p>
                <input type="file" wire:model="file" accept=".pdf,.txt,.md,.docx" class="block w-full text-sm">
                <div wire:loading wire:target="file" class="text-xs text-slate-500">Uploading…</div>
                @if ($file)
                    <p class="text-xs text-slate-600" wire:loading.remove wire:target="file">Chosen: {{ $file->getClientOriginalName() }}</p>
                @endif
                @error('file') <p class="text-sm text-red-700">{{ $message }}</p> @enderror
                <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Upload file</button>
            </form>

            <form wire:submit="addText" class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                <h2 class="font-medium">Add text</h2>
                <div>
                    <label for="text-title" class="block text-sm font-medium">Title</label>
                    <input id="text-title" type="text" wire:model="textTitle" placeholder="Pasted text" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                </div>
                <div>
                    <label for="text" class="block text-sm font-medium">Text</label>
                    <textarea id="text" rows="5" wire:model="text" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"></textarea>
                    @error('text') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
                </div>
                <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Add text</button>
            </form>

            <form wire:submit="addWebPage" class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                <h2 class="font-medium">Add web page</h2>
                <div>
                    <label for="url" class="block text-sm font-medium">Web address</label>
                    <input id="url" type="text" wire:model="url" placeholder="https://" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    @error('url') <p class="mt-1 text-sm text-red-700">{{ $message }}</p> @enderror
                </div>
                <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Add web page</button>
            </form>
        </section>

        <section class="lg:col-span-2" wire:poll.3s>
            @if ($stillWaiting)
                <p class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
                    <strong>Still waiting?</strong> Sources are usually ready within a minute. If nothing changes, ask whoever set up Assistant Studio to start the background processing.
                </p>
            @endif
            @if ($sources->isEmpty())
                <p class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                    Add files, text or web pages so your assistant knows what to say.
                </p>
            @else
                <ul class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                    @foreach ($sources as $source)
                        <li class="flex items-center justify-between gap-4 px-4 py-3" wire:key="source-{{ $source->id }}">
                            <div class="min-w-0">
                                <p class="truncate font-medium">{{ $source->title }}</p>
                                <p class="text-xs text-slate-500">{{ $source->type->label() }} &middot; added {{ $source->created_at->format('j M Y') }}</p>
                            </div>
                            <div class="flex shrink-0 items-center gap-3">
                                <x-badge :status="$source->status" :tooltip="$source->error_message" />
                                @if ($source->status === \App\Enums\SourceStatus::Failed)
                                    <button type="button" wire:click="tryAgain({{ $source->id }})" class="text-sm text-blue-700 hover:underline">Try again</button>
                                @endif
                                <button type="button" wire:click="remove({{ $source->id }})" wire:confirm="Remove this source? Your assistant will forget what it learned from it." class="text-sm text-red-700 hover:underline">Remove</button>
                            </div>
                        </li>
                    @endforeach
                </ul>
            @endif
        </section>
    </div>
</div>
