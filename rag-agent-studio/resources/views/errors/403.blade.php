@component('layouts.app', ['title' => 'No access'])
    <x-error-page heading="You don't have access to that page">
        {{ "It belongs to a different workspace, or you're not allowed to do that. If you think you should have access, ask the owner of your workspace." }}
    </x-error-page>
@endcomponent
