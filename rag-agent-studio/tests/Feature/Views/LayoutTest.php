<?php

use App\Enums\AgentStatus;
use App\Models\Agent;
use App\Models\User;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\View;

it('wraps a page with the studio navigation when logged in', function () {
    $this->actingAs(User::factory()->create());

    $html = View::make('layouts.app', ['slot' => 'PAGE BODY', 'title' => 'Projects'])->render();

    expect($html)->toContain('PAGE BODY')
        ->toContain('<title>Projects')
        ->toContain(route('projects.index'))
        ->toContain(route('team'))
        ->toContain(route('logout'))
        ->toContain('Log out');
});

it('hides the studio navigation from visitors', function () {
    $html = View::make('layouts.app', ['slot' => 'SIGN IN'])->render();

    expect($html)->toContain('SIGN IN')
        ->toContain('<title>'.config('app.name'))
        ->not->toContain(route('team'))
        ->not->toContain('Log out');
});

it('never mentions the technology behind the assistant', function () {
    $this->actingAs(User::factory()->create());
    $html = View::make('layouts.app', ['slot' => ''])->render();
    $html .= Blade::render('<x-badge :status="$s" /><x-agent-tabs :agent="$a" />', [
        's' => AgentStatus::Draft,
        'a' => Agent::factory()->create(),
    ]);

    $text = strtolower(strip_tags($html));

    foreach (['token', 'chunk', 'embedding', 'model', 'temperature', 'api key', 'agent', 'bot', 'corpus', 'rag'] as $word) {
        expect(preg_match('/\b'.preg_quote($word, '/').'\b/', $text))->toBe(0, "'{$word}' appears in the layout");
    }
});
