<?php

namespace App\Livewire\Agents;

use App\Enums\ConversationOrigin;
use App\Models\Agent;
use App\Models\Conversation;
use App\Services\Rag\AnswerService;
use Illuminate\Contracts\View\View;
use Livewire\Component;

class AgentTest extends Component
{
    public Agent $agent;

    public ?int $conversationId = null;

    public string $message = '';

    public function mount(Agent $agent): void
    {
        $this->authorize('view', $agent);

        $this->agent = $agent;
    }

    public function send(AnswerService $answers): void
    {
        $this->validate(
            ['message' => ['required', 'string', 'max:2000']],
            ['message.required' => 'Please type a message', 'message.max' => 'Please keep your message under 2000 characters'],
        );

        $conversation = $this->conversation() ?? $this->agent->conversations()->create([
            'organisation_id' => $this->agent->organisation_id,
            'origin' => ConversationOrigin::Test,
        ]);
        $this->conversationId = $conversation->id;

        $answers->answer($conversation, trim($this->message));

        $this->message = '';
    }

    public function startOver(): void
    {
        $this->conversationId = null;
        $this->message = '';
    }

    private function conversation(): ?Conversation
    {
        return $this->conversationId === null
            ? null
            : $this->agent->conversations()->find($this->conversationId);
    }

    public function render(): View
    {
        return view('livewire.agents.agent-test', [
            'messages' => $this->conversation()?->messages ?? collect(),
            'hasKnowledge' => $this->agent->hasReadySource(),
        ])->title($this->agent->name);
    }
}
