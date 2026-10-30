<?php

namespace Database\Factories;

use App\Enums\AgentStatus;
use App\Enums\Tone;
use App\Models\Agent;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Agent>
 */
class AgentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'organisation_id' => fn (array $attributes) => Project::find($attributes['project_id'])->organisation_id,
            'name' => fake()->firstName().' the helper',
            'greeting' => 'Hi! How can I help you today?',
            'tone' => Tone::Friendly,
            'instructions' => 'Answer questions about our products and opening hours.',
            'fallback_message' => "Sorry, I don't know the answer to that.",
            'accent_colour' => '#2563eb',
            'status' => AgentStatus::Draft,
            'published_at' => null,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => AgentStatus::Published,
            'published_at' => now(),
        ]);
    }

    public function unpublished(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => AgentStatus::Unpublished,
            'published_at' => now()->subDay(),
        ]);
    }
}
