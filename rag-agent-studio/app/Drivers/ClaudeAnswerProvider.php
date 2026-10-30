<?php

namespace App\Drivers;

use App\Contracts\AnswerProvider;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class ClaudeAnswerProvider implements AnswerProvider
{
    public function answer(string $system, array $messages): string
    {
        $response = Http::withHeaders([
            'x-api-key' => config('studio.anthropic_api_key'),
            'anthropic-version' => '2023-06-01',
        ])
            ->post('https://api.anthropic.com/v1/messages', [
                'model' => config('studio.answer_model'),
                'max_tokens' => 1024,
                'system' => $system,
                'messages' => $messages,
            ])
            ->throw();

        $blocks = collect(is_array($response->json('content')) ? $response->json('content') : [])
            ->where('type', 'text')
            ->pluck('text');

        if ($blocks->isEmpty()) {
            throw new RuntimeException('The answer service sent back something unexpected');
        }

        return $blocks->implode(' ');
    }
}
