<?php

namespace Database\Factories;

use App\Models\Agent;
use App\Models\EmbedKey;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<EmbedKey>
 */
class EmbedKeyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agent_id' => Agent::factory(),
            'organisation_id' => fn (array $attributes) => Agent::find($attributes['agent_id'])->organisation_id,
            'public_key' => Str::random(32),
            'revoked_at' => null,
        ];
    }

    public function revoked(): static
    {
        return $this->state(fn (array $attributes) => [
            'revoked_at' => now()->subHour(),
        ]);
    }
}
