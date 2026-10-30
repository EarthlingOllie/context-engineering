<?php

namespace App\Livewire\Agents;

use App\Enums\SourceStatus;
use App\Enums\SourceType;
use App\Jobs\IngestSource;
use App\Models\Agent;
use App\Models\Source;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Livewire\Component;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;
use Livewire\WithFileUploads;

class AgentKnowledge extends Component
{
    use WithFileUploads;

    public Agent $agent;

    public ?TemporaryUploadedFile $file = null;

    public string $textTitle = '';

    public string $text = '';

    public string $url = '';

    public function mount(Agent $agent): void
    {
        $this->authorize('view', $agent);

        $this->agent = $agent;
    }

    public function uploadFile(): void
    {
        $this->validate(
            ['file' => ['required', 'file', 'extensions:pdf,txt,md,docx', 'max:'.(config('studio.max_file_mb') * 1024)]],
            ['file.*' => 'Please choose a PDF, Word, text or Markdown file under 10 MB'],
        );

        $name = $this->file->getClientOriginalName();
        $path = $this->file->storeAs(
            "sources/{$this->agent->id}",
            Str::uuid().'.'.strtolower($this->file->getClientOriginalExtension()),
            ['disk' => config('filesystems.default')],
        );

        $this->addSource(['type' => SourceType::File, 'title' => $name, 'path' => $path]);

        $this->file = null;
    }

    public function addText(): void
    {
        $this->text = trim($this->text);

        $this->validate(
            ['text' => ['required', 'string'], 'textTitle' => ['nullable', 'string', 'max:120']],
            ['text.required' => 'Please paste some text'],
        );

        $this->addSource([
            'type' => SourceType::Text,
            'title' => trim($this->textTitle) !== '' ? trim($this->textTitle) : 'Pasted text',
            'raw_text' => $this->text,
        ]);

        $this->reset('textTitle', 'text');
    }

    public function addWebPage(): void
    {
        $this->validate(
            ['url' => ['required', 'url:http,https', 'max:2000']],
            ['url.*' => 'Please enter a valid web address starting with http'],
        );

        $this->addSource(['type' => SourceType::Url, 'title' => $this->url, 'url' => $this->url]);

        $this->reset('url');
    }

    public function remove(int $sourceId): void
    {
        $source = $this->findSource($sourceId);

        $this->authorize('delete', $source);

        if ($source->path !== null) {
            Storage::delete($source->path);
        }

        $source->chunks()->delete();
        $source->delete();
    }

    public function tryAgain(int $sourceId): void
    {
        $source = $this->findSource($sourceId);

        if ($source->status !== SourceStatus::Failed) {
            return;
        }

        $source->update(['status' => SourceStatus::Pending, 'error_message' => null]);

        IngestSource::dispatch($source);
    }

    public function render(): View
    {
        return view('livewire.agents.agent-knowledge', [
            'sources' => $this->agent->sources()->latest()->orderByDesc('id')->get(),
        ])->title($this->agent->name);
    }

    /** @param  array<string, mixed>  $attributes */
    private function addSource(array $attributes): void
    {
        $this->authorize('update', $this->agent);

        $source = $this->agent->sources()->create($attributes + [
            'organisation_id' => $this->agent->organisation_id,
            'status' => SourceStatus::Pending,
        ]);

        IngestSource::dispatch($source);
    }

    private function findSource(int $sourceId): Source
    {
        return $this->agent->sources()->findOrFail($sourceId);
    }
}
