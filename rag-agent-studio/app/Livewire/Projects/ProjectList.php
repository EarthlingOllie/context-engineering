<?php

namespace App\Livewire\Projects;

use Illuminate\Contracts\View\View;
use Livewire\Component;

class ProjectList extends Component
{
    public bool $creating = false;

    public string $name = '';

    public function startCreating(): void
    {
        $this->creating = true;
    }

    public function create(): void
    {
        $this->validate(
            ['name' => ['required', 'string', 'max:120']],
            ['name.required' => 'Please give the project a name'],
        );

        auth()->user()->organisation->projects()->create(['name' => $this->name]);

        $this->reset('creating', 'name');
    }

    public function render(): View
    {
        return view('livewire.projects.project-list', [
            'projects' => auth()->user()->organisation->projects()->withCount('agents')->latest()->get(),
        ])->title('Projects');
    }
}
