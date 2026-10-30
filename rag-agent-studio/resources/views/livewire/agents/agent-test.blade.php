<div>
    <p class="mb-2 text-sm"><a href="{{ route('projects.show', $agent->project) }}" class="text-slate-600 hover:underline">&larr; {{ $agent->project->name }}</a></p>

    <div class="mb-4 flex items-center gap-3">
        <h1 class="text-2xl font-semibold">{{ $agent->name }}</h1>
        <x-badge :status="$agent->status" />
    </div>

    <x-agent-tabs :agent="$agent" />

    <div class="max-w-2xl rounded-lg border border-slate-200 bg-white">
        @unless ($hasKnowledge)
            <div class="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
                Add knowledge first. <a href="{{ route('agents.knowledge', $agent) }}" class="underline">Go to Knowledge</a> so your assistant has something to answer from.
            </div>
        @endunless

        <div class="flex h-96 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
            @forelse ($messages as $entry)
                <div class="max-w-[85%] rounded-lg px-3 py-2 text-sm {{ $entry->role === \App\Enums\MessageRole::User ? 'self-end bg-blue-600 text-white' : 'self-start bg-slate-100 text-slate-900' }}">
                    <p class="mb-1 text-xs font-semibold {{ $entry->role === \App\Enums\MessageRole::User ? 'text-blue-100' : 'text-slate-500' }}">{{ $entry->role->label() }}</p>
                    <p class="whitespace-pre-wrap">{{ $entry->content }}</p>
                    @if ($entry->sources)
                        <p class="mt-2 text-xs text-slate-500">Based on: {{ collect($entry->sources)->pluck('title')->join(', ') }}</p>
                    @endif
                </div>
            @empty
                <p class="m-auto text-sm text-slate-500">Ask a question to see how your assistant replies.</p>
            @endforelse
        </div>

        <form wire:submit="send" class="border-t border-slate-200 p-3">
            <div class="flex gap-2">
                <input type="text" wire:model="message" aria-label="Your message" placeholder="Type your message" class="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
                <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Send</button>
                <button type="button" wire:click="startOver" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Start over</button>
            </div>
            @error('message') <p class="mt-2 text-sm text-red-700">{{ $message }}</p> @enderror
        </form>
    </div>
</div>
