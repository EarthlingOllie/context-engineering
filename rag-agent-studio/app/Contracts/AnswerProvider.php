<?php

namespace App\Contracts;

interface AnswerProvider
{
    /**
     * Produce the assistant's next reply.
     *
     * @param  list<array{role: string, content: string}>  $messages
     */
    public function answer(string $system, array $messages): string;
}
