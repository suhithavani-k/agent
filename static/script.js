const messagesEl = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const stateEl = document.getElementById('serviceState');
const modelSelect = document.getElementById('modelSelect');
const modelLabel = document.getElementById('selectedModelLabel');
const welcome = document.getElementById('welcomeBlock');

let history = [];
let sending = false;

function timeNow() {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

function addMessage(role, text, { copyable = false } = {}) {
  welcome.hidden = true;
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '●' : '🍪';
  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const timestamp = document.createElement('span');
  timestamp.textContent = timeNow();
  meta.append(timestamp);
  if (copyable) {
    const copy = document.createElement('button');
    copy.className = 'copy-button';
    copy.type = 'button';
    copy.textContent = 'Copy response';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; }
      catch { copy.textContent = 'Copy unavailable'; }
      setTimeout(() => { copy.textContent = 'Copy response'; }, 1400);
    });
    meta.append(copy);
  }
  wrap.append(bubble, meta);
  if (role === 'assistant') row.append(avatar, wrap);
  else row.append(wrap, avatar);
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'message-row assistant typing';
  row.innerHTML = '<div class="message-avatar" aria-hidden="true">🍪</div><div class="bubble-wrap"><div class="bubble" aria-label="Assistant is typing"><i></i><i></i><i></i></div></div>';
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

async function loadStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    stateEl.classList.toggle('connected', Boolean(data.connected));
    stateEl.classList.toggle('disconnected', !data.connected);
    stateEl.lastElementChild.textContent = data.connected ? 'AI Service Connected' : 'AI Service Disconnected';
    if (data.selected_model) modelLabel.textContent = `AI Model: ${data.selected_model}`;
  } catch {
    stateEl.classList.add('disconnected');
    stateEl.lastElementChild.textContent = 'AI Service Disconnected';
  }
}

async function loadModels() {
  try {
    const response = await fetch('/api/models');
    const data = await response.json();
    if (!data.success || !Array.isArray(data.models) || !data.models.length) {
      modelSelect.innerHTML = '<option value="">No models available</option>';
      return;
    }
    modelSelect.replaceChildren(...data.models.map(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      option.title = model.id;
      option.selected = model.id === data.selected_model;
      return option;
    }));
    modelLabel.textContent = `AI Model: ${modelSelect.selectedOptions[0]?.textContent || data.selected_model}`;
  } catch {
    modelSelect.innerHTML = '<option value="">Models unavailable</option>';
  }
}

modelSelect.addEventListener('change', async () => {
  const model = modelSelect.value;
  try {
    const response = await fetch('/api/model', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Could not select model');
    modelLabel.textContent = `AI Model: ${modelSelect.selectedOptions[0]?.textContent || model}`;
  } catch (error) {
    addMessage('assistant', error.message || 'Could not select that model. Please try another.');
    await loadModels();
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || sending) return;
  addMessage('user', message);
  const priorHistory = history.slice(-16);
  history.push({ role: 'user', content: message });
  input.value = '';
  input.style.height = 'auto';
  sending = true;
  sendButton.disabled = true;
  const typing = showTyping();
  try {
    const response = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: priorHistory })
    });
    const data = await response.json();
    typing.remove();
    const answer = data.response || 'I could not prepare a response. Please try again.';
    addMessage('assistant', answer, { copyable: true });
    if (data.success) history.push({ role: 'assistant', content: answer });
  } catch {
    typing.remove();
    addMessage('assistant', 'We could not reach the assistant. Please check your connection and try again.');
  } finally {
    sending = false;
    sendButton.disabled = false;
    input.focus();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
});
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  input.value = button.dataset.prompt;
  form.requestSubmit();
}));

function resetChat() {
  history = [];
  messagesEl.replaceChildren(welcome);
  welcome.hidden = false;
  input.value = '';
  input.focus();
}
document.getElementById('newChat').addEventListener('click', resetChat);
document.getElementById('clearChat').addEventListener('click', resetChat);

loadStatus();
loadModels();
