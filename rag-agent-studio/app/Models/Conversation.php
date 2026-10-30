<?php

namespace App\Models;

use App\Enums\ConversationOrigin;
use Database\Factories\ConversationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Conversation extends Model
{
    /** @use HasFactory<ConversationFactory> */
    use HasFactory;

    protected $fillable = ['organisation_id', 'agent_id', 'embed_key_id', 'origin', 'visitor_token'];

    protected function casts(): array
    {
        return [
            'origin' => ConversationOrigin::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Conversation $conversation): void {
            $conversation->visitor_token ??= (string) Str::uuid();
        });
    }

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }

    public function embedKey(): BelongsTo
    {
        return $this->belongsTo(EmbedKey::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at')->orderBy('id');
    }
}
