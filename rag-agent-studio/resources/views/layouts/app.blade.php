<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ isset($title) ? $title.' · '.config('app.name') : config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-slate-50 text-slate-900 antialiased">
    <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <a href="{{ auth()->check() ? route('projects.index') : route('login') }}" class="text-lg font-semibold">
                {{ config('app.name') }}
            </a>
            @auth
                <nav class="flex items-center gap-4 text-sm">
                    <a href="{{ route('projects.index') }}" class="hover:underline {{ request()->routeIs('projects.*', 'agents.*') ? 'font-semibold' : '' }}">Projects</a>
                    <a href="{{ route('team') }}" class="hover:underline {{ request()->routeIs('team') ? 'font-semibold' : '' }}">Team</a>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit" class="text-slate-600 hover:underline">Log out</button>
                    </form>
                </nav>
            @endauth
        </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-8">
        {{ $slot }}
    </main>
</body>
</html>
