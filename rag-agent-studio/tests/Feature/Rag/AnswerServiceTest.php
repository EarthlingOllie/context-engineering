<?php

use App\Contracts\AnswerProvider;
use App\Enums\MessageRole;
use App\Enums\Tone;
use App\Models\Agent;
use App\Models\Chunk;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Source;
use App\Services\Rag\AnswerService;

/** An answer provider that remembers what it was asked and replies with a fixed line. */
function recordingProvider(string $reply = 'Recorded reply'): AnswerProvider
{
    return new class($reply) implements AnswerProvider
    {
        public string $system = '';

        public array $messages = [];

        public function __construct(private string $reply) {}

        public function answer(string $system, array $messages): string
        {
            $this->system = $system;
            $this->messages = $messages;

            return $this->reply;
        }
    };
}

function serviceWith(AnswerProvider $provider): AnswerService
{
    return app()->makeWith(AnswerService::class, ['provider' => $provider]);
}

it('replies using the fake provider and stores both sides of the exchange', function () {
    $agent = Agent::factory()->create();
    $source = Source::factory()->ready()->for($agent)->create(['title' => 'Opening hours']);
    Chunk::factory()->for($source)->create(['content' => 'We open at 9am.']);
    $conversation = Conversation::factory()->for($agent)->create();

    $result = app(AnswerService::class)->answer($conversation, 'When do you open?');

    expect($result)->toBe([
        'reply' => 'Fake answer about: When do you open?',
        'sources' => [['source_id' => $source->id, 'title' => 'Opening hours']],
    ]);

    $messages = $conversation->messages()->get();
    expect($messages)->toHaveCount(2)
        ->and($messages[0]->role)->toBe(MessageRole::User)
        ->and($messages[0]->content)->toBe('When do you open?')
        ->and($messages[0]->sources)->toBe([])
        ->and($messages[1]->role)->toBe(MessageRole::Assistant)
        ->and($messages[1]->content)->toBe('Fake answer about: When do you open?')
        ->and($messages[1]->sources)->toBe([['source_id' => $source->id, 'title' => 'Opening hours']]);
});

it('briefs the provider with the persona, the fallback rule and the knowledge it found', function () {
    $agent = Agent::factory()->create([
        'name' => 'Benny',
        'tone' => Tone::Professional,
        'instructions' => 'Help with bakery orders.',
        'fallback_message' => 'Please ask the bakery directly.',
    ]);
    $hours = Source::factory()->ready()->for($agent)->create(['title' => 'Opening hours']);
    $menu = Source::factory()->ready()->for($agent)->create(['title' => 'Menu']);
    Chunk::factory()->for($hours)->create(['content' => 'Open 9 to 5.', 'embedding' => [1.0, 0.0]]);
    Chunk::factory()->for($menu)->create(['content' => 'Sourdough is 4.', 'embedding' => [0.9, 0.1]]);
    $conversation = Conversation::factory()->for($agent)->create();
    $provider = recordingProvider();

    serviceWith($provider)->answer($conversation, 'How much is bread?');

    expect($provider->system)
        ->toContain('You are Benny')
        ->toContain('Be polite and professional.')
        ->toContain('Help with bakery orders.')
        ->toContain('If the answer is not in the context, say exactly: Please ask the bakery directly.')
        ->toContain('<context>')
        ->toContain('<source title="Opening hours">Open 9 to 5.</source>')
        ->toContain('<source title="Menu">Sourdough is 4.</source>')
        ->toContain('</context>');
    expect($provider->messages)->toBe([['role' => 'user', 'content' => 'How much is bread?']]);
});

it('describes each tone in plain words', function (Tone $tone, string $sentence) {
    $agent = Agent::factory()->create(['tone' => $tone]);
    $conversation = Conversation::factory()->for($agent)->create();
    $provider = recordingProvider();

    serviceWith($provider)->answer($conversation, 'Hi');

    expect($provider->system)->toContain($sentence);
})->with([
    [Tone::Friendly, 'Be warm and friendly.'],
    [Tone::Professional, 'Be polite and professional.'],
    [Tone::Concise, 'Keep answers short and direct.'],
]);

it('answers from an empty context and cites nothing when there is no knowledge', function () {
    $conversation = Conversation::factory()->create();
    $provider = recordingProvider('I do not know.');

    $result = serviceWith($provider)->answer($conversation, 'Anything?');

    expect($result)->toBe(['reply' => 'I do not know.', 'sources' => []])
        ->and($provider->system)->toContain("<context>\n</context>");
});

it('cites each source once even when several of its chunks were used', function () {
    $agent = Agent::factory()->create();
    $source = Source::factory()->ready()->for($agent)->create(['title' => 'FAQ']);
    Chunk::factory()->count(3)->for($source)->create();
    $conversation = Conversation::factory()->for($agent)->create();

    $result = serviceWith(recordingProvider())->answer($conversation, 'Hello');

    expect($result['sources'])->toBe([['source_id' => $source->id, 'title' => 'FAQ']]);
});

it('only hands the provider the last ten turns of the conversation', function () {
    config(['studio.history_turns' => 10]);
    $conversation = Conversation::factory()->create();
    foreach (range(1, 12) as $turn) {
        Message::factory()->for($conversation)->create(['content' => "Question {$turn}", 'created_at' => now()->addSeconds($turn * 2)]);
        Message::factory()->assistant()->for($conversation)->create(['content' => "Answer {$turn}", 'created_at' => now()->addSeconds($turn * 2 + 1)]);
    }
    $provider = recordingProvider();

    serviceWith($provider)->answer($conversation, 'Question 13');

    expect($provider->messages)->toHaveCount(21)
        ->and($provider->messages[0])->toBe(['role' => 'user', 'content' => 'Question 3'])
        ->and($provider->messages[1])->toBe(['role' => 'assistant', 'content' => 'Answer 3'])
        ->and($provider->messages[19])->toBe(['role' => 'assistant', 'content' => 'Answer 12'])
        ->and($provider->messages[20])->toBe(['role' => 'user', 'content' => 'Question 13']);
});

it('only retrieves as many chunks as the studio is configured to use', function () {
    config(['studio.top_k' => 2]);
    $agent = Agent::factory()->create();
    $source = Source::factory()->ready()->for($agent)->create();
    Chunk::factory()->count(5)->for($source)->create();
    $conversation = Conversation::factory()->for($agent)->create();
    $provider = recordingProvider();

    serviceWith($provider)->answer($conversation, 'Hello');

    expect(substr_count($provider->system, '<source title='))->toBe(2);
});
