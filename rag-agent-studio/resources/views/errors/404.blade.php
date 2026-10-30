@component('layouts.app', ['title' => 'Page not found'])
    <x-error-page heading="We couldn't find that page">
        The link may be out of date, or the page may have been removed. If someone sent you this link, ask them for a new one.
    </x-error-page>
@endcomponent
