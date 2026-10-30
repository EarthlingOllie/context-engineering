<?php

namespace App\Drivers;

use App\Contracts\AnswerProvider;

class FakeAnswerProvider implements AnswerProvider
{
    public function answer(string $system, array $messages): string
    {
        $lastUserMessage = collect($messages)
            ->where('role', 'user')
            ->last()['content'] ?? '';

        return 'Fake answer about: '.$lastUserMessage;
    }
}
