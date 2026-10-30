<?php

namespace App\Http\Controllers;

use App\Models\EmbedKey;
use Illuminate\Http\Response;

class EmbedScriptController extends Controller
{
    /** The website snippet loads this: a floating chat button that opens the hosted chat page. */
    public function __invoke(string $public_key): Response
    {
        $key = EmbedKey::active()->where('public_key', $public_key)->first();
        $agent = $key?->agent;

        $script = $agent?->isLive()
            ? view('embed.script', [
                'agent' => $agent,
                'chatUrl' => rtrim(config('app.url'), '/').'/chat/'.$key->public_key.'?embedded=1',
            ])->render()
            : "/* This assistant is not available right now. */\n";

        return response($script)
            ->header('Content-Type', 'application/javascript; charset=UTF-8')
            ->header('Cache-Control', 'max-age=300, public');
    }
}
