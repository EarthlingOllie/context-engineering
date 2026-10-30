<?php

namespace App\Livewire\Agents;

use App\Models\Agent;
use App\Services\AgentPublisher;
use App\Services\CannotPublish;
use Illuminate\Contracts\View\View;
use Livewire\Component;

class AgentShare extends Component
{
    public Agent $agent;

    public function mount(Agent $agent): void
    {
        $this->authorize('view', $agent);

        $this->agent = $agent;
    }

    public function publish(AgentPublisher $publisher): void
    {
        $this->authorize('update', $this->agent);

        try {
            $publisher->publish($this->agent);
        } catch (CannotPublish $e) {
            $this->addError('publish', $e->getMessage());
        }
    }

    public function takeOffline(AgentPublisher $publisher): void
    {
        $this->authorize('update', $this->agent);

        $publisher->unpublish($this->agent);
    }

    public function resetLink(AgentPublisher $publisher): void
    {
        $this->authorize('update', $this->agent);

        $publisher->resetKey($this->agent);
    }

    public function render(): View
    {
        $key = $this->agent->embedKey()->first();
        $base = rtrim(config('app.url'), '/');

        return view('livewire.agents.agent-share', [
            'canPublish' => $this->agent->hasReadySource(),
            'shareLink' => $key ? $base.route('chat.show', $key->public_key, false) : null,
            'snippet' => $key ? '<script src="'.$base.route('embed.script', $key->public_key, false).'" async></script>' : null,
        ])->title($this->agent->name);
    }
}
