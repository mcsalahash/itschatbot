(function () {
  'use strict';

  var API_URL = (window.TSB_CHATBOT_URL || '').replace(/\/$/, '');
  var STORAGE_KEY = 'tsb_history';
  var MAX_HISTORY = 20;
  var WELCOME_MSG = 'Bonjour ! Je suis Sebti, l’assistant de l’Institution Tahar Sebti 👋 Comment puis-je vous aider ?';
  var SUGGESTIONS = [
    '🏫 Présentation de l’institution',
    '📋 Les structures proposées',
    '❤️ Comment nous soutenir ?',
    '📞 Contact et localisation',
  ];

  var panel, messagesEl, inputEl, sendBtn, bubble;
  var isOpen = false;
  var isLoading = false;

  function getHistory() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (e) {}
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function appendMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'tsb-msg tsb-msg-' + role;
    var content = document.createElement('div');
    content.className = 'tsb-msg-content';
    content.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    div.appendChild(content);
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'tsb-msg tsb-msg-bot';
    div.id = 'tsb-typing';
    var typing = document.createElement('div');
    typing.className = 'tsb-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    div.appendChild(typing);
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function removeTyping() {
    var el = document.getElementById('tsb-typing');
    if (el) el.remove();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showWelcome() {
    appendMessage('bot', WELCOME_MSG);
    var suggestionsDiv = document.createElement('div');
    suggestionsDiv.className = 'tsb-suggestions';
    SUGGESTIONS.forEach(function (text) {
      var btn = document.createElement('button');
      btn.className = 'tsb-suggestion';
      btn.textContent = text;
      btn.addEventListener('click', function () {
        suggestionsDiv.remove();
        sendMessage(text);
      });
      suggestionsDiv.appendChild(btn);
    });
    messagesEl.appendChild(suggestionsDiv);
    scrollToBottom();
  }

  async function sendMessage(text) {
    if (isLoading || !text.trim()) return;
    isLoading = true;
    sendBtn.disabled = true;

    var history = getHistory();
    history.push({ role: 'user', content: text });
    saveHistory(history);

    appendMessage('user', text);
    showTyping();

    try {
      var response = await fetch(API_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      var data = await response.json();
      removeTyping();

      if (data.error) {
        appendMessage('bot', data.error);
      } else {
        var reply = data.reply || '';
        history.push({ role: 'assistant', content: reply });
        saveHistory(history);
        appendMessage('bot', reply);
      }
    } catch (e) {
      removeTyping();
      appendMessage('bot', 'Une erreur réseau est survenue. Veuillez vérifier votre connexion et réessayer.');
    }

    isLoading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  function togglePanel() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('tsb-open');
      bubble.setAttribute('aria-expanded', 'true');
      inputEl.focus();
      if (getHistory().length === 0 && messagesEl.children.length === 0) {
        showWelcome();
      }
    } else {
      panel.classList.remove('tsb-open');
      bubble.setAttribute('aria-expanded', 'false');
    }
  }

  function buildWidget() {
    // Bubble button
    bubble = document.createElement('button');
    bubble.className = 'tsb-bubble';
    bubble.setAttribute('aria-label', 'Ouvrir le chatbot');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    bubble.addEventListener('click', togglePanel);

    // Panel
    panel = document.createElement('div');
    panel.className = 'tsb-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chatbot Sebti');

    // Header
    var header = document.createElement('div');
    header.className = 'tsb-header';
    header.innerHTML =
      '<div class="tsb-header-avatar">🤖</div>' +
      '<div class="tsb-header-info">' +
        '<div class="tsb-header-name">Sebti</div>' +
        '<div class="tsb-header-status">Assistant Tahar Sebti</div>' +
      '</div>';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'tsb-header-close';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.addEventListener('click', togglePanel);
    header.appendChild(closeBtn);

    // Messages
    messagesEl = document.createElement('div');
    messagesEl.className = 'tsb-messages';
    messagesEl.setAttribute('aria-live', 'polite');

    // Reload session history into view
    var history = getHistory();
    if (history.length > 0) {
      history.forEach(function (m) {
        var role = m.role === 'assistant' ? 'bot' : m.role;
        appendMessage(role, m.content);
      });
    }

    // Input area
    var inputArea = document.createElement('div');
    inputArea.className = 'tsb-input-area';

    inputEl = document.createElement('textarea');
    inputEl.className = 'tsb-input';
    inputEl.placeholder = 'Posez votre question…';
    inputEl.rows = 1;
    inputEl.setAttribute('aria-label', 'Message');
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var text = inputEl.value.trim();
        inputEl.value = '';
        inputEl.style.height = '';
        sendMessage(text);
      }
    });
    inputEl.addEventListener('input', function () {
      inputEl.style.height = '';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
    });

    sendBtn = document.createElement('button');
    sendBtn.className = 'tsb-send';
    sendBtn.setAttribute('aria-label', 'Envoyer');
    sendBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    sendBtn.addEventListener('click', function () {
      var text = inputEl.value.trim();
      inputEl.value = '';
      inputEl.style.height = '';
      sendMessage(text);
    });

    inputArea.appendChild(inputEl);
    inputArea.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(inputArea);

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
