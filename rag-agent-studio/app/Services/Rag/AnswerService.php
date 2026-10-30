<?php

namespace App\Services\Rag;

use App\Contracts\AnswerProvider;
use App\Enums\MessageRole;
use App\Enums\Tone;
use App\Models\Agent;
use App\Models\Chunk;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Support\Collection;

class AnswerService
{
    public function __construct(private Retriever $retriever, private AnswerProvider $provider) {}

    /**
     * Answer a visitor's question inside a conversation, remembering both sides.
     *
     * @return array{reply: string, sources: list<array{source_id: int, title: string}>}
     */
    public function answer(Conversation $conversation, string $question): array
    {
        $agent = $conversation->agent;
        $chunks = $this->retriever->retrieve($agent, $question, (int) config('studio.top_k'));

        $history = $this->history($conversation);
        $history[] = ['role' => MessageRole::User->value, 'content' => $question];

        $reply = $this->provider->answer($this->systemPrompt($agent, $chunks), $history);

        $sources = $chunks
            ->map(fn (Chunk $chunk) => ['source_id' => $chunk->source_id, 'title' => $chunk->source->title])
            ->unique('title')
            ->values()
            ->all();

        $conversation->messages()->create(['role' => MessageRole::User, 'content' => $question]);
        $conversation->messages()->create(['role' => MessageRole::Assistant, 'content' => $reply, 'sources' => $sources]);

        return ['reply' => $reply, 'sources' => $sources];
    }

    /**
     * The most recent turns (a visitor question and the assistant's answer), oldest first.
     *
     * @return list<array{role: string, content: string}>
     */
    private function history(Conversation $conversation): array
    {
        $limit = 2 * (int) config('studio.history_turns');

        return $conversation->messages()
            ->reorder()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->reverse()
            ->map(fn (Message $message) => ['role' => $message->role->value, 'content' => $message->content])
            ->values()
            ->all();
    }

    /** @param  Collection<int, Chunk>  $chunks */
    private function systemPrompt(Agent $agent, Collection $chunks): string
    {
        $context = $chunks
            ->map(fn (Chunk $chunk) => '<source title="'.e($chunk->source->title).'">'.$chunk->content.'</source>')
            ->all();

        return implode("\n", [
            "You are {$agent->name}, an assistant that answers questions for visitors.",
            $this->toneSentence($agent->tone),
            $agent->instructions,
            "Answer only from the context below. If the answer is not in the context, say exactly: {$agent->fallback_message}",
            '<context>',
            ...$context,
            '</context>',
        ]);
    }

    private function toneSentence(Tone $tone): string
    {
        return match ($tone) {
            Tone::Friendly => 'Be warm and friendly.',
            Tone::Professional => 'Be polite and professional.',
            Tone::Concise => 'Keep answers short and direct.',
        };
    }
}
