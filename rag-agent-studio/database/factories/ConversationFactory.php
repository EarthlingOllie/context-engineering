<?php

namespace Database\Factories;

use App\Enums\ConversationOrigin;
use App\Models\Agent;
use App\Models\Conversation;
use App\Models\EmbedKey;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Conversation>
 */
class ConversationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agent_id' => Agent::factory(),
            'organisation_id' => fn (array $attributes) => Agent::find($attributes['agent_id'])->organisation_id,
            'embed_key_id' => null,
            'origin' => ConversationOrigin::Test,
            'visitor_token' => (string) Str::uuid(),
        ];
    }

    public function embedded(EmbedKey $key): static
    {
        return $this->state(fn (array $attributes) => [
            'organisation_id' => $key->organisation_id,
            'agent_id' => $key->agent_id,
            'embed_key_id' => $key->id,
            'origin' => ConversationOrigin::Embed,
        ]);
    }
}
