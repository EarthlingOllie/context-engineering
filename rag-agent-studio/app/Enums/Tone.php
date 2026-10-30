<?php

namespace App\Enums;

enum Tone: string
{
    case Friendly = 'friendly';
    case Professional = 'professional';
    case Concise = 'concise';

    public function label(): string
    {
        return match ($this) {
            self::Friendly => 'Friendly',
            self::Professional => 'Professional',
            self::Concise => 'Short and direct',
        };
    }
}
