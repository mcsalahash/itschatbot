(function () {
  'use strict';

  var API_URL = (window.TSB_CHATBOT_URL || '').replace(/\/$/, '');
  var STORAGE_KEY = 'tsb_history';
  var MAX_HISTORY = 20;
  var WELCOME_MSG = 'Bonjour ! Je suis Sebti, l’assistant de l’Institution Tahar Sebti 👋 Comment puis-je vous aider ?';
  var SUGGESTIONS = [
    '🏫 Pr\xe9sentation de l’institution',
    '📋 Les structures propos\xe9es',
    '❤️ Comment nous soutenir ?',
    '📞 Contact et localisation',
  ];

  var panel, messagesEl, inputEl, sendBtn, bubble, labelEl;
  var isOpen = false;
  var isLoading = false;

  /* ── Histoire ── */
  function getHistory() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveHistory(h) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(-MAX_HISTORY))); }
    catch (e) {}
  }

  /* ── Son de notification ── */
  function playDing() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  /* ── Markdown simple ── */
  function renderMarkdown(text) {
    var lines = text.split('\n');
    var html = '';
    var inList = false;

    lines.forEach(function (line) {
      // Headings
      if (/^###\s+/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<strong>' + inline(line.replace(/^###\s+/, '')) + '</strong><br>';
        return;
      }
      if (/^##\s+/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<strong>' + inline(line.replace(/^##\s+/, '')) + '</strong><br>';
        return;
      }
      // List items
      if (/^[\*\-]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
        if (!inList) { html += '<ul class="tsb-list">'; inList = true; }
        html += '<li>' + inline(line.replace(/^[\*\-\d\.]+\s+/, '')) + '</li>';
        return;
      }
      if (inList) { html += '</ul>'; inList = false; }
      // Empty line
      if (line.trim() === '') {
        html += '<br>';
        return;
      }
      html += inline(line) + '<br>';
    });
    if (inList) html += '</ul>';
    return html;
  }

  function inline(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  /* ── Timestamp ── */
  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* ── Append message ── */
  function appendMessage(role, text, isMarkdown) {
    var div = document.createElement('div');
    div.className = 'tsb-msg tsb-msg-' + role;

    var content = document.createElement('div');
    content.className = 'tsb-msg-content';
    if (isMarkdown && role === 'bot') {
      content.innerHTML = renderMarkdown(text);
    } else {
      content.textContent = text;
    }
    div.appendChild(content);

    // Timestamp
    var ts = document.createElement('div');
    ts.className = 'tsb-msg-time';
    ts.textContent = nowTime();
    div.appendChild(ts);

    // Copy button (bot only)
    if (role === 'bot') {
      var copyBtn = document.createElement('button');
      copyBtn.className = 'tsb-copy-btn';
      copyBtn.title = 'Copier';
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(text).then(function () {
          copyBtn.innerHTML = '✓';
          setTimeout(function () {
            copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 1500);
        });
      });
      div.appendChild(copyBtn);
    }

    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  /* ── Typing indicator ── */
  function showTyping() {
    var div = document.createElement('div');
    div.className = 'tsb-msg tsb-msg-bot';
    div.id = 'tsb-typing';
    var t = document.createElement('div');
    t.className = 'tsb-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    div.appendChild(t);
    messagesEl.appendChild(div);
    scrollToBottom();
  }
  function removeTyping() {
    var el = document.getElementById('tsb-typing');
    if (el) el.remove();
  }

  function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

  /* ── Welcome ── */
  function showWelcome() {
    appendMessage('bot', WELCOME_MSG, false);
    var sg = document.createElement('div');
    sg.className = 'tsb-suggestions';
    SUGGESTIONS.forEach(function (text) {
      var btn = document.createElement('button');
      btn.className = 'tsb-suggestion';
      btn.textContent = text;
      btn.addEventListener('click', function () { sg.remove(); sendMessage(text); });
      sg.appendChild(btn);
    });
    messagesEl.appendChild(sg);
    scrollToBottom();
  }

  /* ── Nouvelle conversation ── */
  function resetConversation() {
    sessionStorage.removeItem(STORAGE_KEY);
    messagesEl.innerHTML = '';
    showWelcome();
  }

  /* ── Formulaire de contact ── */
  var FORM_MARKER = /\[SHOW_CONTACT_FORM:(inscription|contact)\]/;

  function parseReply(raw) {
    var match = raw.match(FORM_MARKER);
    return { text: raw.replace(FORM_MARKER, '').trim(), formType: match ? match[1] : null };
  }

  function showContactForm(type) {
    var titles = { inscription: '📋 Demande d\'inscription', contact: '✉️ Message \xe0 la direction' };
    var form = document.createElement('div');
    form.className = 'tsb-contact-form';
    var title = document.createElement('div');
    title.className = 'tsb-contact-form-title';
    title.textContent = titles[type] || '✉️ Nous contacter';
    form.appendChild(title);

    function field(ph, t) {
      var el = document.createElement(t === 'textarea' ? 'textarea' : 'input');
      el.className = 'tsb-contact-input' + (t === 'textarea' ? ' tsb-contact-textarea' : '');
      el.placeholder = ph;
      if (t !== 'textarea') el.type = t || 'text';
      return el;
    }

    var nomEl = field('Nom complet *', 'text');
    var telEl = field('T\xe9l\xe9phone *', 'tel');
    var emailEl = field('Email *', 'email');
    var msgEl = field('Votre message *', 'textarea');
    var submitEl = document.createElement('button');
    submitEl.className = 'tsb-contact-submit';
    submitEl.textContent = 'Envoyer';
    [nomEl, telEl, emailEl, msgEl, submitEl].forEach(function (el) { form.appendChild(el); });

    var wrapper = document.createElement('div');
    wrapper.className = 'tsb-msg tsb-msg-bot';
    wrapper.appendChild(form);
    messagesEl.appendChild(wrapper);
    scrollToBottom();

    submitEl.addEventListener('click', async function () {
      var nom = nomEl.value.trim(), tel = telEl.value.trim(),
          eml = emailEl.value.trim(), msg = msgEl.value.trim();
      if (!nom || !tel || !eml || !msg) {
        submitEl.textContent = 'Veuillez remplir tous les champs';
        setTimeout(function () { submitEl.textContent = 'Envoyer'; }, 2000);
        return;
      }
      submitEl.disabled = true; submitEl.textContent = 'Envoi en cours…';
      try {
        var r = await fetch(API_URL + '/api/contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: nom, telephone: tel, email: eml, message: msg, type: type }),
        });
        var d = await r.json();
        if (d.ok) {
          form.innerHTML = '';
          var ok = document.createElement('div');
          ok.className = 'tsb-contact-success';
          ok.textContent = '✅ Message envoy\xe9 ! L’\xe9quipe de l’ITS vous contactera tr\xe8s prochainement.';
          form.appendChild(ok);
          var h = getHistory();
          h.push({ role: 'assistant', content: '[Formulaire soumis]' });
          saveHistory(h);
        } else {
          submitEl.disabled = false; submitEl.textContent = d.error || 'Erreur, r\xe9essayez';
        }
      } catch (e) { submitEl.disabled = false; submitEl.textContent = 'Erreur r\xe9seau'; }
      scrollToBottom();
    });
  }

  /* ── Détection langue ── */
  function getUserLang() {
    var lang = (navigator.language || navigator.userLanguage || 'fr').toLowerCase();
    if (lang.startsWith('ar')) return 'ar';
    return 'fr';
  }

  /* ── Envoi de message ── */
  async function sendMessage(text) {
    if (isLoading || !text.trim()) return;
    isLoading = true; sendBtn.disabled = true;

    var history = getHistory();
    history.push({ role: 'user', content: text });
    saveHistory(history);
    appendMessage('user', text, false);
    showTyping();

    try {
      var response = await fetch(API_URL + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, lang: getUserLang() }),
      });
      var data = await response.json();
      removeTyping();

      if (data.error) {
        appendMessage('bot', data.error, false);
      } else {
        var raw = data.reply || '';
        var parsed = parseReply(raw);
        history.push({ role: 'assistant', content: raw });
        saveHistory(history);
        if (parsed.text) { appendMessage('bot', parsed.text, true); playDing(); }
        if (parsed.formType) showContactForm(parsed.formType);
      }
    } catch (e) {
      removeTyping();
      appendMessage('bot', 'Une erreur r\xe9seau est survenue. Veuillez v\xe9rifier votre connexion et r\xe9essayer.', false);
    }

    isLoading = false; sendBtn.disabled = false; inputEl.focus();
  }

  /* ── Toggle panel ── */
  function togglePanel() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('tsb-open');
      bubble.setAttribute('aria-expanded', 'true');
      if (labelEl) labelEl.classList.add('tsb-hidden');
      inputEl.focus();
      if (getHistory().length === 0 && messagesEl.children.length === 0) showWelcome();
    } else {
      panel.classList.remove('tsb-open');
      bubble.setAttribute('aria-expanded', 'false');
    }
  }

  /* ── Construction du widget ── */
  function buildWidget() {
    var wrapper = document.createElement('div');
    wrapper.className = 'tsb-bubble-wrapper';

    labelEl = document.createElement('div');
    labelEl.className = 'tsb-bubble-label';
    labelEl.textContent = '💬 Besoin d\'aide ?';
    labelEl.addEventListener('click', togglePanel);

    bubble = document.createElement('button');
    bubble.className = 'tsb-bubble';
    bubble.setAttribute('aria-label', 'Ouvrir le chatbot');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    bubble.addEventListener('click', togglePanel);

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

    var resetBtn = document.createElement('button');
    resetBtn.className = 'tsb-header-reset';
    resetBtn.title = 'Nouvelle conversation';
    resetBtn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>';
    resetBtn.addEventListener('click', function (e) { e.stopPropagation(); resetConversation(); });

    var closeBtn = document.createElement('button');
    closeBtn.className = 'tsb-header-close';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.addEventListener('click', togglePanel);

    header.appendChild(resetBtn);
    header.appendChild(closeBtn);

    // Messages
    messagesEl = document.createElement('div');
    messagesEl.className = 'tsb-messages';
    messagesEl.setAttribute('aria-live', 'polite');

    var history = getHistory();
    if (history.length > 0) {
      history.forEach(function (m) {
        var role = m.role === 'assistant' ? 'bot' : m.role;
        appendMessage(role, m.content, role === 'bot');
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
        var t = inputEl.value.trim(); inputEl.value = ''; inputEl.style.height = '';
        sendMessage(t);
      }
    });
    inputEl.addEventListener('input', function () {
      inputEl.style.height = '';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
    });

    sendBtn = document.createElement('button');
    sendBtn.className = 'tsb-send';
    sendBtn.setAttribute('aria-label', 'Envoyer');
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    sendBtn.addEventListener('click', function () {
      var t = inputEl.value.trim(); inputEl.value = ''; inputEl.style.height = '';
      sendMessage(t);
    });

    inputArea.appendChild(inputEl);
    inputArea.appendChild(sendBtn);
    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(inputArea);

    wrapper.appendChild(labelEl);
    wrapper.appendChild(bubble);
    document.body.appendChild(wrapper);
    document.body.appendChild(panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
