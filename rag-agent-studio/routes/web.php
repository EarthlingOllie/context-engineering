<?php

use App\Http\Controllers\ChatPageController;
use App\Http\Controllers\EmbedScriptController;
use App\Http\Controllers\LogoutController;
use App\Livewire\Agents;
use App\Livewire\Auth;
use App\Livewire\Projects;
use App\Livewire\Team;
use Illuminate\Support\Facades\Route;

// Signing up, logging in and joining a workspace
Route::get('/register', Auth\Register::class)->name('register');
Route::get('/login', Auth\Login::class)->name('login');
Route::post('/logout', LogoutController::class)->middleware('auth')->name('logout');
Route::get('/invite/{token}', Auth\AcceptInvite::class)->name('invite.accept');

// The studio: everything here needs a logged-in teammate
Route::middleware('auth')->group(function () {
    Route::get('/', fn () => redirect()->route('projects.index'));

    Route::get('/projects', Projects\ProjectList::class)->name('projects.index');
    Route::get('/projects/{project}', Projects\ProjectShow::class)->name('projects.show');

    Route::get('/agents/{agent}/setup', Agents\AgentSetup::class)->name('agents.setup');
    Route::get('/agents/{agent}/knowledge', Agents\AgentKnowledge::class)->name('agents.knowledge');
    Route::get('/agents/{agent}/test', Agents\AgentTest::class)->name('agents.test');
    Route::get('/agents/{agent}/share', Agents\AgentShare::class)->name('agents.share');

    Route::get('/team', Team\TeamPage::class)->name('team');
});

// Public: the hosted chat page and the website snippet
Route::get('/chat/{public_key}', ChatPageController::class)->name('chat.show');
Route::get('/embed/{public_key}.js', EmbedScriptController::class)->name('embed.script');
