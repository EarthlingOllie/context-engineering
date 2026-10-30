<?php

namespace App\Livewire\Projects;

use App\Models\Project;
use Illuminate\Contracts\View\View;
use Livewire\Component;

class ProjectShow extends Component
{
    public Project $project;

    public bool $creatingAssistant = false;

    public string $assistantName = '';

    public bool $renaming = false;

    public string $projectName = '';

    public function mount(Project $project): void
    {
        $this->authorize('view', $project);

        $this->project = $project;
    }

    public function startRenaming(): void
    {
        $this->projectName = $this->project->name;
        $this->renaming = true;
    }

    public function rename(): void
    {
        $this->validate(
            ['projectName' => ['required', 'string', 'max:120']],
            ['projectName.required' => 'Please give the project a name'],
        );

        $this->project->update(['name' => $this->projectName]);

        $this->renaming = false;
    }

    public function startCreatingAssistant(): void
    {
        $this->creatingAssistant = true;
    }

    public function createAssistant(): void
    {
        $this->validate(
            ['assistantName' => ['required', 'string', 'max:120']],
            ['assistantName.required' => 'Please give the assistant a name'],
        );

        $agent = $this->project->agents()->create([
            'organisation_id' => $this->project->organisation_id,
            'name' => $this->assistantName,
            'greeting' => 'Hi! How can I help you today?',
            'instructions' => '',
            'fallback_message' => "Sorry, I don't know the answer to that yet.",
        ]);

        $this->redirectRoute('agents.setup', $agent);
    }

    public function deleteProject(): void
    {
        $this->authorize('delete', $this->project);

        $this->project->delete();

        $this->redirectRoute('projects.index');
    }

    public function render(): View
    {
        return view('livewire.projects.project-show', [
            'agents' => $this->project->agents()->withCount('sources')->orderBy('name')->get(),
        ])->title($this->project->name);
    }
}
