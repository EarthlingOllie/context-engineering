<?php

namespace App\Services;

use App\Enums\AgentStatus;
use App\Models\Agent;
use App\Models\EmbedKey;

class AgentPublisher
{
    /** Take an assistant live. Needs at least one ready source; issues a share key if none is active. */
    public function publish(Agent $agent): void
    {
        if (! $agent->hasReadySource()) {
            throw new CannotPublish;
        }

        $agent->update(['status' => AgentStatus::Published, 'published_at' => now()]);

        if ($agent->embedKey()->doesntExist()) {
            $this->issueKey($agent);
        }
    }

    /** Take an assistant offline; its share key stays so going live again keeps the same link. */
    public function unpublish(Agent $agent): void
    {
        $agent->update(['status' => AgentStatus::Unpublished]);
    }

    /** Revoke every active share key and hand out a new one. */
    public function resetKey(Agent $agent): EmbedKey
    {
        $agent->embedKeys()->active()->update(['revoked_at' => now()]);

        return $this->issueKey($agent);
    }

    private function issueKey(Agent $agent): EmbedKey
    {
        return $agent->embedKeys()->create(['organisation_id' => $agent->organisation_id]);
    }
}
