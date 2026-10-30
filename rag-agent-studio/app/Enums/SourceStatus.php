<?php

namespace App\Enums;

enum SourceStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Ready = 'ready';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Waiting',
            self::Processing => 'Reading',
            self::Ready => 'Ready',
            self::Failed => "Couldn't read",
        };
    }

    public function colour(): string
    {
        return match ($this) {
            self::Pending => 'grey',
            self::Processing => 'blue',
            self::Ready => 'green',
            self::Failed => 'red',
        };
    }
}
