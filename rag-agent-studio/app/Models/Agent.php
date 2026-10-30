<?php

namespace App\Models;

use App\Enums\AgentStatus;
use App\Enums\SourceStatus;
use App\Enums\Tone;
use Database\Factories\AgentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Agent extends Model
{
    /** @use HasFactory<AgentFactory> */
    use HasFactory;

    protected $fillable = [
        'organisation_id',
        'project_id',
        'name',
        'greeting',
        'tone',
        'instructions',
        'fallback_message',
        'accent_colour',
        'status',
        'published_at',
    ];

    protected $attributes = [
        'accent_colour' => '#2563eb',
        'status' => 'draft',
        'tone' => 'friendly',
    ];

    protected function casts(): array
    {
        return [
            'tone' => Tone::class,
            'status' => AgentStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function sources(): HasMany
    {
        return $this->hasMany(Source::class);
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(Chunk::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function embedKeys(): HasMany
    {
        return $this->hasMany(EmbedKey::class);
    }

    /** The share key currently in use, if any. */
    public function embedKey(): HasOne
    {
        return $this->hasOne(EmbedKey::class)->whereNull('revoked_at')->latestOfMany();
    }

    public function isLive(): bool
    {
        return $this->status === AgentStatus::Published;
    }

    public function hasReadySource(): bool
    {
        return $this->sources()->where('status', SourceStatus::Ready)->exists();
    }
}
