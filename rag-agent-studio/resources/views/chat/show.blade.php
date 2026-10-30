<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $agent->name }}</title>
    <style>
        :root { --accent: {{ $agent->accent_colour }}; }
        * { box-sizing: border-box; }
        html, body { height: 100%; margin: 0; }
        body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; display: flex; justify-content: center; }
        .chat { display: flex; flex-direction: column; width: 100%; max-width: {{ $embedded ? 'none' : '640px' }}; height: 100vh; background: #fff; }
        .chat-header { background: var(--accent); color: #fff; padding: 14px 16px; font-weight: 600; font-size: 16px; }
        .chat-transcript { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .message { max-width: 85%; padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .message-assistant { align-self: flex-start; background: #f1f5f9; }
        .message-user { align-self: flex-end; background: var(--accent); color: #fff; }
        .message-sources { margin-top: 6px; font-size: 12px; color: #475569; }
        .message-notice { align-self: center; font-size: 13px; color: #b45309; }
        .chat-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e2e8f0; }
        .chat-form input { flex: 1; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
        .chat-form button { padding: 10px 16px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 600; font-size: 14px; cursor: pointer; }
        .chat-form button[disabled] { opacity: .6; cursor: default; }
    </style>
</head>
<body>
    <div class="chat" id="chat" data-api="{{ $apiUrl }}" data-key="{{ $publicKey }}">
        <div class="chat-header">{{ $agent->name }}</div>
        <div class="chat-transcript" id="chat-transcript" aria-live="polite">
            <div class="message message-assistant">{{ $agent->greeting }}</div>
        </div>
        <form class="chat-form" id="chat-form" autocomplete="off">
            <input id="chat-input" name="message" type="text" maxlength="2000" placeholder="Type your message" aria-label="Your message" required>
            <button type="submit" id="chat-send">Send</button>
        </form>
    </div>
    <script src="{{ asset('chat.js') }}"></script>
</body>
</html>
