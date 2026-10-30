<?php

use App\Enums\AgentStatus;
use App\Enums\SourceStatus;

it('shows the status in plain words with its colour', function ($status, string $label, string $colour) {
    $this->blade('<x-badge :status="$status" />', ['status' => $status])
        ->assertSee($label)
        ->assertSee('badge-'.$colour)
        ->assertDontSee($status->value);
})->with([
    [AgentStatus::Draft, 'Draft', 'grey'],
    [AgentStatus::Published, 'Live', 'green'],
    [AgentStatus::Unpublished, 'Offline', 'amber'],
    [SourceStatus::Pending, 'Waiting', 'grey'],
    [SourceStatus::Processing, 'Reading', 'blue'],
    [SourceStatus::Ready, 'Ready', 'green'],
    [SourceStatus::Failed, "Couldn't read", 'red'],
]);

it('explains a failure in a tooltip', function () {
    $this->blade('<x-badge :status="$status" tooltip="We could not open that file." />', ['status' => SourceStatus::Failed])
        ->assertSee('title="We could not open that file."', false);
});

it('has no tooltip by default', function () {
    $this->blade('<x-badge :status="$status" />', ['status' => SourceStatus::Ready])
        ->assertDontSee('title=', false);
});
