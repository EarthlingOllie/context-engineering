<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $agent->name }}</title>
    <style>
        body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        p { color: #475569; font-size: 14px; margin: 0; }
    </style>
</head>
<body>
    <div>
        <h1>{{ $agent->name }}</h1>
        <p>This assistant is currently unavailable.</p>
        <p>Please check back later.</p>
    </div>
</body>
</html>
