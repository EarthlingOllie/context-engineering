@props(['heading'])

<div class="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center">
    <h1 class="text-xl font-semibold">{{ $heading }}</h1>
    <p class="mt-2 text-sm text-slate-600">{{ $slot }}</p>
    @auth
        <a href="{{ route('projects.index') }}" class="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Go to your projects</a>
    @else
        <a href="{{ route('login') }}" class="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Log in</a>
    @endauth
</div>
