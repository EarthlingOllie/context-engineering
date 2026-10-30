(function () {
    var root = document.getElementById('chat');
    if (!root) { return; }

    var apiUrl = root.getAttribute('data-api');
    var storageKey = 'assistant-chat-' + root.getAttribute('data-key');
    var transcript = document.getElementById('chat-transcript');
    var form = document.getElementById('chat-form');
    var input = document.getElementById('chat-input');
    var sendButton = document.getElementById('chat-send');
    var conversationId = null;

    try { conversationId = window.sessionStorage.getItem(storageKey); } catch (e) { conversationId = null; }

    function remember(id) {
        conversationId = id;
        try { window.sessionStorage.setItem(storageKey, id); } catch (e) { /* storage may be blocked inside some iframes */ }
    }

    function addMessage(text, kind) {
        var bubble = document.createElement('div');
        bubble.className = 'message message-' + kind;
        bubble.textContent = text;
        transcript.appendChild(bubble);
        transcript.scrollTop = transcript.scrollHeight;
        return bubble;
    }

    function addReply(reply, sources) {
        var bubble = addMessage(reply, 'assistant');
        if (sources && sources.length) {
            var titles = [];
            for (var i = 0; i < sources.length; i++) { titles.push(sources[i].title); }
            var basedOn = document.createElement('div');
            basedOn.className = 'message-sources';
            basedOn.textContent = 'Based on: ' + titles.join(', ');
            bubble.appendChild(basedOn);
        }
    }

    function problemText(status) {
        if (status === 403) { return 'This assistant is currently unavailable.'; }
        if (status === 429) { return 'You are sending messages a little too quickly. Please wait a moment and try again.'; }
        if (status === 422) { return 'Please keep your message under 2000 characters.'; }
        return 'Something went wrong. Please try again.';
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        var message = input.value.trim();
        if (!message) { return; }

        addMessage(message, 'user');
        input.value = '';
        input.disabled = true;
        sendButton.disabled = true;

        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ message: message, conversation_id: conversationId })
        }).then(function (response) {
            if (!response.ok) { throw response.status; }
            return response.json();
        }).then(function (data) {
            remember(data.conversation_id);
            addReply(data.reply, data.sources);
        }).catch(function (status) {
            addMessage(problemText(status), 'notice');
        }).then(function () {
            input.disabled = false;
            sendButton.disabled = false;
            input.focus();
        });
    });

    input.focus();
})();
