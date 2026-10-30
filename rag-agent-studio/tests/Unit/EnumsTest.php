<?php

use App\Enums\AgentStatus;
use App\Enums\ConversationOrigin;
use App\Enums\MessageRole;
use App\Enums\Role;
use App\Enums\SourceStatus;
use App\Enums\SourceType;
use App\Enums\Tone;

it('labels assistant statuses in plain words', function () {
    expect(AgentStatus::Draft->label())->toBe('Draft')
        ->and(AgentStatus::Published->label())->toBe('Live')
        ->and(AgentStatus::Unpublished->label())->toBe('Offline')
        ->and(AgentStatus::Draft->value)->toBe('draft')
        ->and(AgentStatus::Published->value)->toBe('published')
        ->and(AgentStatus::Unpublished->value)->toBe('unpublished');
});

it('gives assistant statuses a badge colour', function () {
    expect(AgentStatus::Draft->colour())->toBe('grey')
        ->and(AgentStatus::Published->colour())->toBe('green')
        ->and(AgentStatus::Unpublished->colour())->toBe('amber');
});

it('labels source statuses in plain words', function () {
    expect(SourceStatus::Pending->label())->toBe('Waiting')
        ->and(SourceStatus::Processing->label())->toBe('Reading')
        ->and(SourceStatus::Ready->label())->toBe('Ready')
        ->and(SourceStatus::Failed->label())->toBe("Couldn't read")
        ->and(SourceStatus::Pending->value)->toBe('pending')
        ->and(SourceStatus::Processing->value)->toBe('processing')
        ->and(SourceStatus::Ready->value)->toBe('ready')
        ->and(SourceStatus::Failed->value)->toBe('failed');
});

it('gives source statuses a badge colour', function () {
    expect(SourceStatus::Pending->colour())->toBe('grey')
        ->and(SourceStatus::Processing->colour())->toBe('blue')
        ->and(SourceStatus::Ready->colour())->toBe('green')
        ->and(SourceStatus::Failed->colour())->toBe('red');
});

it('labels source types', function () {
    expect(SourceType::File->label())->toBe('File')
        ->and(SourceType::Text->label())->toBe('Text')
        ->and(SourceType::Url->label())->toBe('Web page')
        ->and(SourceType::File->value)->toBe('file')
        ->and(SourceType::Text->value)->toBe('text')
        ->and(SourceType::Url->value)->toBe('url');
});

it('labels tones', function () {
    expect(Tone::Friendly->label())->toBe('Friendly')
        ->and(Tone::Professional->label())->toBe('Professional')
        ->and(Tone::Concise->label())->toBe('Short and direct')
        ->and(Tone::Friendly->value)->toBe('friendly')
        ->and(Tone::Professional->value)->toBe('professional')
        ->and(Tone::Concise->value)->toBe('concise');
});

it('labels team roles', function () {
    expect(Role::Owner->label())->toBe('Owner')
        ->and(Role::Member->label())->toBe('Member')
        ->and(Role::Owner->value)->toBe('owner')
        ->and(Role::Member->value)->toBe('member');
});

it('labels where a conversation started', function () {
    expect(ConversationOrigin::Test->label())->toBe('Test chat')
        ->and(ConversationOrigin::Embed->label())->toBe('Website')
        ->and(ConversationOrigin::Test->value)->toBe('test')
        ->and(ConversationOrigin::Embed->value)->toBe('embed');
});

it('labels who wrote a message', function () {
    expect(MessageRole::User->label())->toBe('You')
        ->and(MessageRole::Assistant->label())->toBe('Assistant')
        ->and(MessageRole::User->value)->toBe('user')
        ->and(MessageRole::Assistant->value)->toBe('assistant');
});
