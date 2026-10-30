<?php

namespace App\Drivers;

use App\Contracts\AnswerProvider;
use Illuminate\Support\Facades\Http;

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

        return collect($response->json('content'))
            ->where('type', 'text')
            ->pluck('text')
            ->implode(' ');
    }
}
