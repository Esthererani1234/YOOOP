const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const suggested = document.getElementById('suggested');
const chatForm = document.getElementById('chatForm');

const STORAGE_KEY = 'yooop-ai-chat';
const MAX_LOCAL_MESSAGES = 60;
const quick = [
  'Where is my latest order?',
  'Help me return an item',
  'My package is late',
  'I received the wrong item',
  'Help me choose a product',
  'Talk to human support'
];

let history = readLocal(STORAGE_KEY, []);
let sending = false;

function readLocal(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function formatMessage(value) {
  const safe = escapeHtml(value);
  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•]\s+(.+)$/gm, '<span class="chat-list-item">• $1</span>')
    .replace(/\n/g, '<br>');
}

function saveHistory() {
  history = history.slice(-MAX_LOCAL_MESSAGES);
  writeLocal(STORAGE_KEY, history);
}

function pushMessage(role, text) {
  history.push({ role, text: String(text), time: Date.now() });
  saveHistory();
  render();
}

function render() {
  if (!chatBody) return;

  chatBody.innerHTML = history.map((message) => `
    <div class="message ${message.role === 'user' ? 'user' : ''}">
      <div class="avatar">${message.role === 'user' ? 'YOU' : 'AI'}</div>
      <div class="bubble">${formatMessage(message.text)}</div>
    </div>
  `).join('');

  chatBody.scrollTop = chatBody.scrollHeight;

  if (suggested) {
    suggested.innerHTML = quick.map((question) => `
      <button type="button" onclick="askShortcut('${question.replace(/'/g, "\\'")}')">
        ${escapeHtml(question)}
      </button>
    `).join('');
  }
}

function setTyping(show) {
  const existing = document.getElementById('typing');
  if (!show) {
    existing?.remove();
    return;
  }

  if (existing || !chatBody) return;
  chatBody.insertAdjacentHTML('beforeend', `
    <div id="typing" class="message">
      <div class="avatar">AI</div>
      <div class="typing"><i></i><i></i><i></i></div>
    </div>
  `);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function getCustomerContext() {
  const orders = readLocal('yooop-orders', []);
  const profile = readLocal('yooop-user', readLocal('yooop-profile', {}));
  const cart = readLocal('yooop-cart', {});

  return {
    profile: sanitizeProfile(profile),
    cart: sanitizeCart(cart),
    orders: sanitizeOrders(orders),
    page: window.location.pathname
  };
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return {};
  return {
    first: profile.first || profile.name || '',
    last: profile.last || '',
    email: profile.email || '',
    city: profile.city || '',
    state: profile.state || '',
    zip: profile.zip || ''
  };
}

function sanitizeCart(cart) {
  if (!cart || typeof cart !== 'object') return {};
  return Object.fromEntries(Object.entries(cart).slice(0, 30));
}

function sanitizeOrders(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.slice(0, 10).map((order) => ({
    id: order?.id || '',
    date: order?.date || '',
    total: order?.total || 0,
    status: order?.status || '',
    address: order?.address || '',
    items: Array.isArray(order?.items)
      ? order.items.slice(0, 10).map((item) => ({
          name: item?.p?.name || item?.name || '',
          quantity: item?.qty || item?.quantity || 1,
          price: item?.p?.price || item?.price || 0
        }))
      : [],
    steps: Array.isArray(order?.steps) ? order.steps.slice(0, 10) : []
  }));
}

async function requestAI() {
  const messages = history
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-20)
    .map((message) => ({ role: message.role, content: message.text }));

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      context: getCustomerContext()
    })
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // The server returned a non-JSON error page.
  }

  if (!response.ok) {
    throw new Error(data.error || 'The AI assistant could not respond right now.');
  }

  if (!data.reply) {
    throw new Error('The AI assistant returned an empty response.');
  }

  return data.reply;
}

async function send(text) {
  const value = String(text || chatInput?.value || '').trim();
  if (!value || sending) return;

  sending = true;
  if (chatInput) {
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatInput.disabled = true;
  }

  const submitButton = chatForm?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  pushMessage('user', value);
  setTyping(true);

  try {
    const reply = await requestAI();
    setTyping(false);
    pushMessage('assistant', reply);
  } catch (error) {
    setTyping(false);
    pushMessage('assistant', `${error.message}\n\nYou can still open Customer Service or Messages for help.`);
  } finally {
    sending = false;
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.focus();
    }
    if (submitButton) submitButton.disabled = false;
  }
}

function askShortcut(question) {
  send(question);
}

function clearChat() {
  history = [];
  saveHistory();
  welcome();
}

function createHumanTicket(subject) {
  const tickets = readLocal('yooop-support-tickets', []);
  const id = `YT-${String(Date.now()).slice(-7)}`;
  tickets.unshift({
    id,
    subject,
    status: 'Open',
    created: new Date().toISOString()
  });
  writeLocal('yooop-support-tickets', tickets);
  pushMessage('assistant', `Support ticket ${id} was created on this device. Open Customer Service or Messages to continue.`);
}

function welcome() {
  pushMessage(
    'assistant',
    'Hi! I’m YOOOP AI Customer Care. You can speak naturally—I can understand questions about orders, delivery, returns, refunds, damaged items, account access, and product choices.'
  );
}

chatForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  send();
});

chatInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

chatInput?.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 130)}px`;
});

if (!history.length) welcome();
else render();
