<?php

namespace App\Models;

use Database\Factories\ChunkFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Chunk extends Model
{
    /** @use HasFactory<ChunkFactory> */
    use HasFactory;

    protected $fillable = [
        'organisation_id',
        'agent_id',
        'source_id',
        'position',
        'content',
        'embedding',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'embedding' => 'array',
        ];
    }

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
