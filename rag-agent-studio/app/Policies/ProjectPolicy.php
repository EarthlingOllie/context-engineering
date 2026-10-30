<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function view(User $user, Project $project): bool
    {
        return $user->organisation_id === $project->organisation_id;
    }

    public function update(User $user, Project $project): bool
    {
        return $user->organisation_id === $project->organisation_id;
    }

    public function delete(User $user, Project $project): bool
    {
        return $user->can('manageTeam', $project->organisation);
    }
}
