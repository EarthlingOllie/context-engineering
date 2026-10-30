<?php

namespace App\Policies;

use App\Models\Organisation;
use App\Models\User;

class OrganisationPolicy
{
    /** Only an owner may invite or remove teammates and delete projects. */
    public function manageTeam(User $user, Organisation $organisation): bool
    {
        return $user->isOwner() && $user->organisation_id === $organisation->id;
    }
}
