<?php

namespace App\Enums;

enum AgentStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Unpublished = 'unpublished';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Published => 'Live',
            self::Unpublished => 'Offline',
        };
    }

    public function colour(): string
    {
        return match ($this) {
            self::Draft => 'grey',
            self::Published => 'green',
            self::Unpublished => 'amber',
        };
    }
}
