<div class="space-y-8">
    <h1 class="text-2xl font-semibold">Team</h1>

    <section class="rounded-lg border border-slate-200 bg-white" aria-labelledby="members-heading">
        <h2 id="members-heading" class="border-b border-slate-200 px-4 py-3 font-medium">Members</h2>

        @if ($members->count() === 1)
            <p class="px-4 py-6 text-sm text-slate-600">{{ "You're the only member so far." }}</p>
        @endif

        <ul class="divide-y divide-slate-200">
            @foreach ($members as $member)
                <li class="flex items-center justify-between px-4 py-3" wire:key="member-{{ $member->id }}">
                    <div>
                        <p class="font-medium">{{ $member->name }}</p>
                        <p class="text-sm text-slate-600">{{ $member->email }}</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-sm text-slate-600">{{ $member->role->label() }}</span>
                        @if ($canManage && $member->id !== auth()->id())
                            <button type="button" wire:click="remove({{ $member->id }})" wire:confirm="Remove {{ $member->name }} from your workspace?" class="text-sm text-red-600 hover:underline">Remove</button>
                        @endif
                    </div>
                </li>
            @endforeach
        </ul>
    </section>

    @if ($canManage)
        <section class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="mb-3 font-medium">Invite a teammate</h2>
            <form wire:submit="invite" class="flex items-start gap-2">
                <div class="flex-1">
                    <label for="email" class="sr-only">Email</label>
                    <input id="email" type="email" wire:model="email" placeholder="teammate@example.com" class="w-full rounded border border-slate-300 px-3 py-2">
                    @error('email') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
                </div>
                <button type="submit" class="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Invite</button>
            </form>
            @if ($invitedEmail !== '')
                <p class="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
                    {{ "We've emailed {$invitedEmail} an invitation. If it doesn't arrive, copy the link below and send it to them yourself." }}
                </p>
            @endif
        </section>
    @else
        <p class="text-sm text-slate-600">Only the owner can invite teammates.</p>
    @endif

    @if ($invitations->isNotEmpty())
        <section class="rounded-lg border border-slate-200 bg-white" aria-labelledby="invitations-heading">
            <h2 id="invitations-heading" class="border-b border-slate-200 px-4 py-3 font-medium">Pending invitations</h2>
            <ul class="divide-y divide-slate-200">
                @foreach ($invitations as $invitation)
                    <li class="px-4 py-3" wire:key="invitation-{{ $invitation->id }}">
                        <div class="flex items-center justify-between gap-4">
                            <p class="font-medium">{{ $invitation->email }}</p>
                            @if ($canManage)
                                <button type="button" wire:click="cancel({{ $invitation->id }})" class="text-sm text-red-600 hover:underline">Cancel</button>
                            @endif
                        </div>
                        @if ($canManage)
                            <div class="mt-2 flex gap-2">
                                <input id="invitation-link-{{ $invitation->id }}" type="text" readonly aria-label="Invitation link" value="{{ route('invite.accept', $invitation->token) }}" class="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs">
                                <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('invitation-link-{{ $invitation->id }}').value); this.textContent = 'Copied'; setTimeout(() => this.textContent = 'Copy', 1500)" class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Copy</button>
                            </div>
                        @endif
                    </li>
                @endforeach
            </ul>
        </section>
    @endif
</div>
