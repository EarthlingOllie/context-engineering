@props(['agent'])

@php
    $tabs = [
        'agents.setup' => 'Setup',
        'agents.knowledge' => 'Knowledge',
        'agents.test' => 'Test',
        'agents.share' => 'Share',
    ];
@endphp

<nav class="mb-6 flex gap-1 border-b border-slate-200" aria-label="Assistant sections">
    @foreach ($tabs as $routeName => $label)
        @php($active = request()->routeIs($routeName))
        <a
            href="{{ route($routeName, $agent) }}"
            @if ($active) aria-current="page" @endif
            class="-mb-px border-b-2 px-4 py-2 text-sm {{ $active ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900' }}"
        >
            {{ $label }}
        </a>
    @endforeach
</nav>
