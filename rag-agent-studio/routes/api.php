<?php

use App\Http\Controllers\ChatApiController;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

// Each share key and visitor address may send 30 messages a minute
RateLimiter::for('chat', fn (Request $request) => Limit::perMinute(30)
    ->by($request->route('public_key').'|'.$request->ip()));

// Public: the widget and hosted chat page talk to the assistant here
Route::post('/chat/{public_key}', ChatApiController::class)
    ->middleware('throttle:chat')
    ->name('api.chat');
