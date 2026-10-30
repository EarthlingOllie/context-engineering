<?php

namespace Database\Factories;

use App\Models\Chunk;
use App\Models\Source;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Chunk>
 */
class ChunkFactory extends Factory
{
    public function definition(): array
    {
        return [
            'source_id' => Source::factory(),
            'organisation_id' => fn (array $attributes) => Source::find($attributes['source_id'])->organisation_id,
            'agent_id' => fn (array $attributes) => Source::find($attributes['source_id'])->agent_id,
            'position' => 0,
            'content' => fake()->paragraph(),
            'embedding' => array_map(fn () => fake()->randomFloat(4, -1, 1), range(1, 8)),
        ];
    }
}
