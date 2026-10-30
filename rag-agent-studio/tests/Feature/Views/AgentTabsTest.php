<?php

use App\Models\Agent;

it('links every assistant tab by route name', function () {
    $agent = Agent::factory()->create();

    $this->blade('<x-agent-tabs :agent="$agent" />', ['agent' => $agent])
        ->assertSeeInOrder(['Setup', 'Knowledge', 'Test', 'Share'])
        ->assertSee(route('agents.setup', $agent), false)
        ->assertSee(route('agents.knowledge', $agent), false)
        ->assertSee(route('agents.test', $agent), false)
        ->assertSee(route('agents.share', $agent), false);
});

it('highlights the tab for the current screen', function () {
    $agent = Agent::factory()->create();
    $this->get(route('agents.knowledge', $agent)); // sets the current route

    $html = $this->blade('<x-agent-tabs :agent="$agent" />', ['agent' => $agent])->__toString();

    expect($html)->toMatch('/aria-current="page"[^>]*>\s*Knowledge/s')
        ->and(substr_count($html, 'aria-current="page"'))->toBe(1);
});
