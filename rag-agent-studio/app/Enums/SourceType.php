<?php

namespace App\Enums;

enum SourceType: string
{
    case File = 'file';
    case Text = 'text';
    case Url = 'url';

    public function label(): string
    {
        return match ($this) {
            self::File => 'File',
            self::Text => 'Text',
            self::Url => 'Web page',
        };
    }
}
