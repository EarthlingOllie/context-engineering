<?php

use App\Enums\SourceStatus;
use App\Enums\SourceType;
use App\Jobs\IngestSource;
use App\Livewire\Agents\AgentKnowledge;
use App\Models\Agent;
use App\Models\Chunk;
use App\Models\Project;
use App\Models\Source;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;

beforeEach(function () {
    Storage::fake();
    Queue::fake();

    $this->user = User::factory()->create();
    $this->agent = Agent::factory()->for(Project::factory()->for($this->user->organisation))->create(['name' => 'Shop helper']);
});

it('lists what the assistant knows with a status for each source', function () {
    Source::factory()->for($this->agent)->ready()->create(['title' => 'Opening hours', 'created_at' => '2026-03-04 10:00:00']);
    Source::factory()->for($this->agent)->file()->processing()->create(['title' => 'price-list.pdf']);
    Source::factory()->for($this->agent)->url()->create(['title' => 'https://example.com/faq']);
    Source::factory()->for($this->agent)->failed()->create(['title' => 'scan.pdf', 'error_message' => "We couldn't read that PDF"]);

    $this->actingAs($this->user)
        ->get(route('agents.knowledge', $this->agent))
        ->assertOk()
        ->assertSeeLivewire(AgentKnowledge::class)
        ->assertSeeInOrder(['Setup', 'Knowledge', 'Test', 'Share'])
        ->assertSee('Shop helper')
        ->assertSee('Opening hours')->assertSee('Text')->assertSee('Ready')->assertSee('4 Mar 2026')
        ->assertSee('price-list.pdf')->assertSee('File')->assertSee('Reading')
        ->assertSee('https://example.com/faq')->assertSee('Web page')->assertSee('Waiting')
        ->assertSee('scan.pdf')->assertSee("Couldn't read")->assertSee("We couldn't read that PDF")
        ->assertSee('Upload file')->assertSee('Add text')->assertSee('Add web page')
        ->assertSee('Remove')->assertSee('Try again')
        ->assertSeeHtml('wire:poll.3s')
        ->assertDontSee('Add files, text or web pages so your assistant knows what to say.');
});

it('explains what to do when the assistant knows nothing yet', function () {
    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->assertSee('Add files, text or web pages so your assistant knows what to say.')
        ->assertDontSee('Try again')
        ->assertDontSee('Remove');
});

it('keeps people out of assistants in other workspaces', function () {
    $this->actingAs($this->user)->get(route('agents.knowledge', Agent::factory()->create()))->assertForbidden();
});

it('stores an uploaded file and starts reading it', function () {
    $file = UploadedFile::fake()->create('opening-hours.txt', 12, 'text/plain');

    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->set('file', $file)
        ->call('uploadFile')
        ->assertHasNoErrors()
        ->assertSet('file', null)
        ->assertSee('opening-hours.txt')
        ->assertSee('Waiting');

    $source = $this->agent->sources()->sole();

    expect($source->type)->toBe(SourceType::File)
        ->and($source->title)->toBe('opening-hours.txt')
        ->and($source->status)->toBe(SourceStatus::Pending)
        ->and($source->organisation_id)->toBe($this->user->organisation_id)
        ->and($source->path)->toStartWith("sources/{$this->agent->id}/")
        ->and($source->path)->toEndWith('.txt');

    Storage::assertExists($source->path);
    Queue::assertPushed(IngestSource::class, fn (IngestSource $job) => $job->source->is($source));
});

it('only accepts PDF, Word, text or Markdown files under 10 MB', function (?UploadedFile $file) {
    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->set('file', $file)
        ->call('uploadFile')
        ->assertHasErrors(['file'])
        ->assertSee('Please choose a PDF, Word, text or Markdown file under 10 MB');

    expect(Source::count())->toBe(0);
    Queue::assertNothingPushed();
})->with([
    'nothing chosen' => [null],
    'a program' => [fn () => UploadedFile::fake()->create('setup.exe', 12, 'application/octet-stream')],
    'an image' => [fn () => UploadedFile::fake()->image('photo.png')],
    'too big' => [fn () => UploadedFile::fake()->create('huge.pdf', 10 * 1024 + 1, 'application/pdf')],
]);

it('accepts each supported file type', function (string $name, string $mime) {
    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->set('file', UploadedFile::fake()->create($name, 12, $mime))
        ->call('uploadFile')
        ->assertHasNoErrors();

    expect($this->agent->sources()->sole()->title)->toBe($name);
})->with([
    ['guide.pdf', 'application/pdf'],
    ['guide.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['guide.md', 'text/markdown'],
]);

it('saves pasted text and starts reading it', function () {
    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->set('textTitle', 'Returns policy')
        ->set('text', 'Returns are accepted within 30 days.')
        ->call('addText')
        ->assertHasNoErrors()
        ->assertSet('textTitle', '')
        ->assertSet('text', '')
        ->assertSee('Returns policy');

    $source = $this->agent->sources()->sole();

    expect($source->type)->toBe(SourceType::Text)
        ->and($source->title)->toBe('Returns policy')
        ->and($source->raw_text)->toBe('Returns are accepted within 30 days.')
        ->and($source->status)->toBe(SourceStatus::Pending);

    Queue::assertPushed(IngestSource::class, fn (IngestSource $job) => $job->source->is($source));
});

it('names pasted text for you when no title is given', function () {
    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->set('text', 'Some words.')
        ->call('addText')
        ->assertHasNoErrors();

    expect($this->agent->sources()->sole()->title)->toBe('Pasted text');
});

it('asks for some text before adding it', function () {
    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->set('text', '   ')
        ->call('addText')
        ->assertHasErrors(['text'])
        ->assertSee('Please paste some text');

    expect(Source::count())->toBe(0);
    Queue::assertNothingPushed();
});

it('saves a web address and starts reading the page', function () {
    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->set('url', 'https://example.com/faq')
        ->call('addWebPage')
        ->assertHasNoErrors()
        ->assertSet('url', '')
        ->assertSee('https://example.com/faq');

    $source = $this->agent->sources()->sole();

    expect($source->type)->toBe(SourceType::Url)
        ->and($source->title)->toBe('https://example.com/faq')
        ->and($source->url)->toBe('https://example.com/faq')
        ->and($source->status)->toBe(SourceStatus::Pending);

    Queue::assertPushed(IngestSource::class, fn (IngestSource $job) => $job->source->is($source));
});

it('asks for a proper web address', function (string $url) {
    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->set('url', $url)
        ->call('addWebPage')
        ->assertHasErrors(['url'])
        ->assertSee('Please enter a valid web address starting with http');

    expect(Source::count())->toBe(0);
    Queue::assertNothingPushed();
})->with(['', 'example.com/faq', 'ftp://example.com/faq', 'not a web address']);

it('removes a source along with everything read from it', function () {
    Storage::put('sources/1/hours.txt', 'hours');
    $source = Source::factory()->for($this->agent)->file()->ready()->create(['path' => 'sources/1/hours.txt', 'title' => 'hours.txt']);
    Chunk::factory()->for($source)->count(2)->create();
    $other = Source::factory()->for($this->agent)->ready()->create(['title' => 'Keep me']);

    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->assertSeeHtml('wire:confirm')
        ->call('remove', $source->id)
        ->assertDontSee('hours.txt')
        ->assertSee('Keep me');

    expect(Source::find($source->id))->toBeNull()
        ->and(Chunk::where('source_id', $source->id)->count())->toBe(0)
        ->and(Source::find($other->id))->not->toBeNull();
    Storage::assertMissing('sources/1/hours.txt');
});

it('will not remove a source that belongs to another assistant', function () {
    $stranger = Source::factory()->ready()->create();

    $component = Livewire::actingAs($this->user)->test(AgentKnowledge::class, ['agent' => $this->agent]);

    expect(fn () => $component->call('remove', $stranger->id))->toThrow(ModelNotFoundException::class)
        ->and(fn () => $component->call('tryAgain', $stranger->id))->toThrow(ModelNotFoundException::class)
        ->and(Source::find($stranger->id))->not->toBeNull();
});

it('tries again with a source that could not be read', function () {
    $source = Source::factory()->for($this->agent)->failed()->create();

    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->call('tryAgain', $source->id)
        ->assertSee('Waiting')
        ->assertDontSee("Couldn't read");

    $source->refresh();

    expect($source->status)->toBe(SourceStatus::Pending)
        ->and($source->error_message)->toBeNull();
    Queue::assertPushed(IngestSource::class, fn (IngestSource $job) => $job->source->is($source));
});

it('leaves a source alone when it does not need another try', function () {
    $source = Source::factory()->for($this->agent)->ready()->create();

    Livewire::actingAs($this->user)
        ->test(AgentKnowledge::class, ['agent' => $this->agent])
        ->call('tryAgain', $source->id);

    expect($source->fresh()->status)->toBe(SourceStatus::Ready);
    Queue::assertNothingPushed();
});
