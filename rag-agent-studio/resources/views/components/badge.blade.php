@props(['status', 'tooltip' => null])

@php
    $classes = match ($status->colour()) {
        'green' => 'bg-green-100 text-green-800',
        'amber' => 'bg-amber-100 text-amber-800',
        'blue' => 'bg-blue-100 text-blue-800',
        'red' => 'bg-red-100 text-red-800',
        default => 'bg-slate-100 text-slate-700',
    };
@endphp

<span {{ $attributes->merge(['class' => 'badge badge-'.$status->colour().' inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium '.$classes]) }} @if ($tooltip) title="{{ $tooltip }}" @endif>
    {{ $status->label() }}
</span>
