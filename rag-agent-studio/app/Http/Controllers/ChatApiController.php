<?php

namespace App\Http\Controllers;

use App\Enums\ConversationOrigin;
use App\Models\EmbedKey;
use App\Services\Rag\AnswerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ChatApiController extends Controller
{
    public function __invoke(Request $request, string $public_key, AnswerService $answers): JsonResponse
    {
        $key = EmbedKey::active()->where('public_key', $public_key)->firstOrFail();
        $agent = $key->agent;

        if (! $agent->isLive()) {
            return response()->json(['error' => 'unavailable'], 403);
        }

        $validator = Validator::make($request->all(), [
            'message' => ['required', 'string', 'max:2000'],
            'conversation_id' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'invalid', 'message' => $validator->errors()->first()], 422);
        }

        $conversation = $agent->conversations()
            ->where('visitor_token', $validator->validated()['conversation_id'] ?? '')
            ->first();

        $conversation ??= $agent->conversations()->create([
            'organisation_id' => $agent->organisation_id,
            'embed_key_id' => $key->id,
            'origin' => ConversationOrigin::Embed,
        ]);

        $answer = $answers->answer($conversation, $validator->validated()['message']);

        return response()->json([
            'conversation_id' => $conversation->visitor_token,
            'reply' => $answer['reply'],
            'sources' => array_map(fn (array $source) => ['title' => $source['title']], $answer['sources']),
        ]);
    }
}
