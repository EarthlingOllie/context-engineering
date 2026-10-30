<?php

namespace App\Enums;

enum ConversationOrigin: string
{
    case Test = 'test';
    case Embed = 'embed';

    public function label(): string
    {
        return match ($this) {
            self::Test => 'Test chat',
            self::Embed => 'Website',
        };
    }
}
