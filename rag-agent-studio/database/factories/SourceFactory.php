<?php

namespace Database\Factories;

use App\Enums\SourceStatus;
use App\Enums\SourceType;
use App\Models\Agent;
use App\Models\Source;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Source>
 */
class SourceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agent_id' => Agent::factory(),
            'organisation_id' => fn (array $attributes) => Agent::find($attributes['agent_id'])->organisation_id,
            'type' => SourceType::Text,
            'title' => fake()->sentence(3),
            'path' => null,
            'url' => null,
            'raw_text' => fake()->paragraphs(2, true),
            'status' => SourceStatus::Pending,
            'error_message' => null,
            'chunk_count' => 0,
        ];
    }

    public function file(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => SourceType::File,
            'path' => 'sources/'.fake()->uuid().'.txt',
            'raw_text' => null,
        ]);
    }

    public function url(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => SourceType::Url,
            'url' => fake()->url(),
            'raw_text' => null,
        ]);
    }

    public function processing(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => SourceStatus::Processing,
        ]);
    }

    public function ready(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => SourceStatus::Ready,
            'chunk_count' => 3,
        ]);
    }

    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => SourceStatus::Failed,
            'error_message' => "We couldn't read this file.",
        ]);
    }
}
