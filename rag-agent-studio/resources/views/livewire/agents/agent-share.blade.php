<div>
    <p class="mb-2 text-sm"><a href="{{ route('projects.show', $agent->project) }}" class="text-slate-600 hover:underline">&larr; {{ $agent->project->name }}</a></p>

    <div class="mb-4 flex items-center gap-3">
        <h1 class="text-2xl font-semibold">{{ $agent->name }}</h1>
        <x-badge :status="$agent->status" />
    </div>

    <x-agent-tabs :agent="$agent" />

    <div class="max-w-2xl space-y-6">
        <div class="rounded-lg border border-slate-200 bg-white p-6">
            @if ($agent->isLive())
                <p class="text-sm text-slate-700" role="status">Your assistant is live. Anyone with the share link or the website snippet can chat with it.</p>
            @elseif ($agent->status === \App\Enums\AgentStatus::Unpublished)
                <p class="text-sm text-slate-700" role="status">{{ 'Your assistant is offline. The share link and website snippet show a "currently unavailable" message until you publish it again.' }}</p>
            @else
                <p class="text-sm text-slate-700" role="status">Your assistant is not live yet. Publish it to get a share link and a website snippet.</p>
            @endif

            <div class="mt-4 flex flex-wrap items-center gap-3">
                @if ($agent->isLive())
                    <button type="button" wire:click="takeOffline" class="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100">Take offline</button>
                    <button type="button" wire:click="resetLink" wire:confirm="Reset the link? The current share link and website snippet will stop working and you'll get new ones." class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Reset link</button>
                @else
                    <button type="button" wire:click="publish" @disabled(! $canPublish) class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">Publish</button>
                    @unless ($canPublish)
                        <span class="text-sm text-slate-500">Add at least one ready source <a href="{{ route('agents.knowledge', $agent) }}" class="underline">on the Knowledge tab</a></span>
                    @endunless
                @endif
            </div>
            @error('publish') <p class="mt-2 text-sm text-red-700">{{ $message }}</p> @enderror
        </div>

        @if ($agent->isLive())
            <div class="rounded-lg border border-slate-200 bg-white p-6">
                <h2 class="text-base font-semibold">Share link</h2>
                <p class="mt-1 text-sm text-slate-500">Send this link to anyone who should chat with your assistant.</p>
                <div class="mt-3 flex gap-2">
                    <input id="share-link" type="text" readonly aria-label="Share link" value="{{ $shareLink }}" class="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm">
                    <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('share-link').value); this.textContent = 'Copied'; setTimeout(() => this.textContent = 'Copy', 1500)" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Copy</button>
                </div>
            </div>

            <div class="rounded-lg border border-slate-200 bg-white p-6">
                <h2 class="text-base font-semibold">Website snippet</h2>
                <p class="mt-1 text-sm text-slate-500">Paste this one line into your website, just before the closing <code>&lt;/body&gt;</code> tag, to show a chat button in the bottom-right corner.</p>
                <p class="mt-1 text-sm text-slate-500">If someone else looks after your website, send them this line and ask them to add it. On site builders such as Squarespace, Wix or WordPress, look for a "Custom code", "Code injection" or "Footer code" setting and paste it there.</p>
                <div class="mt-3 flex gap-2">
                    <input id="website-snippet" type="text" readonly aria-label="Website snippet" value="{{ $snippet }}" class="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm">
                    <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('website-snippet').value); this.textContent = 'Copied'; setTimeout(() => this.textContent = 'Copy', 1500)" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Copy</button>
                </div>
            </div>
        @endif
    </div>
</div>
