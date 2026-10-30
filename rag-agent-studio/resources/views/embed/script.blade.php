(function () {
    if (document.getElementById('assistant-studio-widget')) { return; }

    var name = @json($agent->name);
    var colour = @json($agent->accent_colour);
    var chatUrl = @json($chatUrl, JSON_UNESCAPED_SLASHES);

    var root = document.createElement('div');
    root.id = 'assistant-studio-widget';
    root.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:system-ui,sans-serif;';

    var frame = document.createElement('iframe');
    frame.src = chatUrl;
    frame.title = 'Chat with ' + name;
    frame.setAttribute('allow', 'clipboard-write');
    frame.style.cssText = 'display:none;width:380px;height:600px;max-width:calc(100vw - 40px);max-height:calc(100vh - 100px);border:0;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.25);background:#fff;margin-bottom:12px;';

    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Chat with ' + name);
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'Chat';
    button.style.cssText = 'display:block;margin-left:auto;width:60px;height:60px;border:0;border-radius:30px;cursor:pointer;color:#fff;font-size:15px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.2);background:' + colour + ';';

    button.addEventListener('click', function () {
        var open = frame.style.display === 'none';
        frame.style.display = open ? 'block' : 'none';
        button.textContent = open ? 'Close' : 'Chat';
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    root.appendChild(frame);
    root.appendChild(button);
    document.body.appendChild(root);
})();
