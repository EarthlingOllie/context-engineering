<?php

namespace App\Models;

use App\Enums\SourceStatus;
use App\Enums\SourceType;
use Database\Factories\SourceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Source extends Model
{
    /** @use HasFactory<SourceFactory> */
    use HasFactory;

    protected $fillable = [
        'organisation_id',
        'agent_id',
        'type',
        'title',
        'path',
        'url',
        'raw_text',
        'status',
        'error_message',
        'chunk_count',
    ];

    protected $attributes = [
        'status' => 'pending',
        'chunk_count' => 0,
    ];

    protected function casts(): array
    {
        return [
            'type' => SourceType::class,
            'status' => SourceStatus::class,
            'chunk_count' => 'integer',
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

    public function chunks(): HasMany
    {
        return $this->hasMany(Chunk::class);
    }
}
