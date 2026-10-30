<?php

namespace App\Http\Controllers;

use App\Models\EmbedKey;
use Illuminate\Contracts\View\View;

class ChatPageController extends Controller
{
    /** The share link and the widget's window: a plain page where visitors chat with the assistant. */
    public function __invoke(string $public_key): View
    {
        $key = EmbedKey::active()->where('public_key', $public_key)->firstOrFail();
        $agent = $key->agent;

        if (! $agent->isLive()) {
            return view('chat.unavailable', ['agent' => $agent]);
        }

        return view('chat.show', [
            'agent' => $agent,
            'apiUrl' => route('api.chat', $key->public_key),
            'publicKey' => $key->public_key,
            'embedded' => request()->boolean('embedded'),
        ]);
    }
}
