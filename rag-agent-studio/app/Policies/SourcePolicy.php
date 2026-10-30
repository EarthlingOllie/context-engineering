<?php

namespace App\Policies;

use App\Models\Source;
use App\Models\User;

class SourcePolicy
{
    public function view(User $user, Source $source): bool
    {
        return $user->organisation_id === $source->organisation_id;
    }

    public function delete(User $user, Source $source): bool
    {
        return $user->organisation_id === $source->organisation_id;
    }
}
