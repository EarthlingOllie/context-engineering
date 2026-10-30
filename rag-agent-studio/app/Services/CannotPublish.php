<?php

namespace App\Services;

use RuntimeException;

class CannotPublish extends RuntimeException
{
    public function __construct(string $message = 'Add at least one ready source')
    {
        parent::__construct($message);
    }
}
