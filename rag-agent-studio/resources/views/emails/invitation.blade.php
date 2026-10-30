<x-mail::message>
# You're invited to {{ $workspaceName }}

@if ($inviterName)
{{ $inviterName }} has invited you to join the **{{ $workspaceName }}** workspace.
@else
You've been invited to join the **{{ $workspaceName }}** workspace.
@endif

<x-mail::button :url="$url">
Join workspace
</x-mail::button>

This link works for 7 days. If you weren't expecting it, you can ignore this email.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
