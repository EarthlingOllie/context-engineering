<?php

namespace App\Livewire\Agents;

use App\Enums\Tone;
use App\Models\Agent;
use Illuminate\Contracts\View\View;
use Illuminate\Validation\Rule;
use Livewire\Component;

class AgentSetup extends Component
{
    public Agent $agent;

    public string $name = '';

    public string $greeting = '';

    public string $tone = '';

    public string $instructions = '';

    public string $fallbackMessage = '';

    public string $accentColour = '';

    public bool $saved = false;

    public function mount(Agent $agent): void
    {
        $this->authorize('view', $agent);

        $this->agent = $agent;
        $this->name = $agent->name;
        $this->greeting = $agent->greeting;
        $this->tone = $agent->tone->value;
        $this->instructions = $agent->instructions;
        $this->fallbackMessage = $agent->fallback_message;
        $this->accentColour = $agent->accent_colour;
    }

    public function save(): void
    {
        $this->saved = false;

        $this->validate(
            [
                'name' => ['required', 'string', 'max:120'],
                'greeting' => ['required', 'string', 'max:500'],
                'tone' => ['required', Rule::enum(Tone::class)],
                'instructions' => ['nullable', 'string', 'max:5000'],
                'fallbackMessage' => ['required', 'string', 'max:500'],
                'accentColour' => ['required', 'hex_color'],
            ],
            [
                'name.required' => 'Please give the assistant a name',
                'greeting.required' => 'Please add a greeting',
                'tone.*' => 'Please choose a tone from the list',
                'fallbackMessage.required' => 'Please add a fallback reply',
                'accentColour.*' => 'Please pick a colour',
            ],
        );

        $this->agent->update([
            'name' => $this->name,
            'greeting' => $this->greeting,
            'tone' => $this->tone,
            'instructions' => $this->instructions,
            'fallback_message' => $this->fallbackMessage,
            'accent_colour' => $this->accentColour,
        ]);

        $this->saved = true;
    }

    public function deleteAssistant(): void
    {
        $this->authorize('delete', $this->agent);

        $project = $this->agent->project;

        $this->agent->delete();

        $this->redirectRoute('projects.show', $project);
    }

    public function render(): View
    {
        return view('livewire.agents.agent-setup', [
            'tones' => Tone::cases(),
        ])->title($this->agent->name);
    }
}
