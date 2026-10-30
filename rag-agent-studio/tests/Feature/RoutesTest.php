<?php

use App\Http\Controllers\ChatPageController;
use App\Http\Controllers\EmbedScriptController;
use App\Http\Controllers\LogoutController;
use App\Livewire\Agents\AgentKnowledge;
use App\Livewire\Agents\AgentSetup;
use App\Livewire\Agents\AgentShare;
use App\Livewire\Agents\AgentTest;
use App\Livewire\Auth\AcceptInvite;
use App\Livewire\Auth\Login;
use App\Livewire\Auth\Register;
use App\Livewire\Projects\ProjectList;
use App\Livewire\Projects\ProjectShow;
use App\Livewire\Team\TeamPage;
use App\Models\Agent;
use App\Models\EmbedKey;
use App\Models\User;
use Illuminate\Support\Facades\Route;

it('registers every screen by name, path and target', function (string $name, string $method, string $uri, string $target, bool $needsLogin) {
    $route = Route::getRoutes()->getByName($name);

    expect($route)->not->toBeNull()
        ->and($route->methods())->toContain($method)
        ->and($route->uri())->toBe($uri)
        ->and($route->getActionName())->toBe($target)
        ->and(in_array('auth', $route->gatherMiddleware()))->toBe($needsLogin);
})->with([
    ['register', 'GET', 'register', Register::class, false],
    ['login', 'GET', 'login', Login::class, false],
    ['logout', 'POST', 'logout', LogoutController::class, true],
    ['invite.accept', 'GET', 'invite/{token}', AcceptInvite::class, false],
    ['projects.index', 'GET', 'projects', ProjectList::class, true],
    ['projects.show', 'GET', 'projects/{project}', ProjectShow::class, true],
    ['agents.setup', 'GET', 'agents/{agent}/setup', AgentSetup::class, true],
    ['agents.knowledge', 'GET', 'agents/{agent}/knowledge', AgentKnowledge::class, true],
    ['agents.test', 'GET', 'agents/{agent}/test', AgentTest::class, true],
    ['agents.share', 'GET', 'agents/{agent}/share', AgentShare::class, true],
    ['team', 'GET', 'team', TeamPage::class, true],
    ['chat.show', 'GET', 'chat/{public_key}', ChatPageController::class, false],
    ['embed.script', 'GET', 'embed/{public_key}.js', EmbedScriptController::class, false],
]);

it('sends the home page to the projects list', function () {
    $this->actingAs(User::factory()->create())
        ->get('/')
        ->assertRedirect(route('projects.index'));
});

it('asks visitors to log in before reaching the studio', function () {
    $this->get('/')->assertRedirect(route('login'));
    $this->get(route('projects.index'))->assertRedirect(route('login'));
    $this->get(route('team'))->assertRedirect(route('login'));
});

it('exposes the chat api alongside the web routes', function () {
    expect(Route::has('api.chat'))->toBeTrue();
});

it('wires the public chat page to its controller', function () {
    $key = EmbedKey::factory()->for(Agent::factory()->published())->create();

    expect($this->get(route('chat.show', $key->public_key))->status())->toBeLessThan(400);
});

it('wires the website snippet to its controller', function () {
    expect($this->get(route('embed.script', 'unknown-key'))->status())->toBeLessThan(400);
});

it('wires logging out to its controller', function () {
    $response = $this->actingAs(User::factory()->create())->post(route('logout'));

    expect($response->status())->toBeLessThan(400);
});
