// ========== STATE ==========
let conversations = [];
let activeConvId = null;
let activeModel = 'openai';
let isProcessing = false;

// ========== LOCALSTORAGE DATABASE ==========
function loadFromStorage() {
  const saved = localStorage.getItem('youz_ai_conversations');
  if (saved) {
    conversations = JSON.parse(saved);
  }
  if (conversations.length === 0) {
    createNewConversation();
  }
}

function saveToStorage() {
  localStorage.setItem('youz_ai_conversations', JSON.stringify(conversations));
}

function createNewConversation() {
  const newConv = {
    id: Date.now().toString(),
    title: 'Percakapan Baru',
    messages: [],
    createdAt: new Date().toISOString()
  };
  conversations.unshift(newConv);
  activeConvId = newConv.id;
  saveToStorage();
  return newConv;
}

// ========== DOM ELEMENTS ==========
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const convList = document.getElementById('conversationList');
const chatMessages = document.getElementById('chatMessages');
const chatTitle = document.getElementById('chatTitle');
const modelBadge = document.getElementById('modelBadge');
const msgInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const imageInput = document.getElementById('imageInput');
const modelBtns = document.querySelectorAll('.model-btn');
const newChatBtn = document.getElementById('newChatBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

// ========== RENDER ==========
function renderSidebar() {
  if (!conversations.length) {
    convList.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">Belum ada percakapan</div>';
    return;
  }
  
  convList.innerHTML = conversations.map(conv => `
    <li class="conv-item ${conv.id === activeConvId ? 'active' : ''}" data-id="${conv.id}">
      <i class="far fa-comment"></i>
      <span class="conv-title">${escapeHtml(conv.title || 'Percakapan Baru')}</span>
      <i class="far fa-trash-alt delete-conv" data-id="${conv.id}"></i>
    </li>
  `).join('');
  
  document.querySelectorAll('.conv-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-conv')) {
        e.stopPropagation();
        deleteConversation(e.target.dataset.id);
      } else {
        switchConversation(item.dataset.id);
      }
    });
  });
}

function switchConversation(id) {
  activeConvId = id;
  const conv = conversations.find(c => c.id === id);
  if (conv) {
    chatTitle.textContent = conv.title;
    renderMessages(conv.messages);
    renderSidebar();
  }
}

function renderMessages(messages) {
  if (!messages || messages.length === 0) {
    chatMessages.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-robot"></i>
        <h3>Youz AI</h3>
        <p>Asisten AI buatan Yuzz Ofc</p>
        <div class="suggestions">
          <button class="suggestion-btn" onclick="window.setInput('Halo Youz AI!')">👋 Halo</button>
          <button class="suggestion-btn" onclick="window.setInput('Apa itu AI?')">🤖 Apa itu AI?</button>
          <button class="suggestion-btn" onclick="window.setInput('Siapa Yuzz Ofc?')">👤 Siapa Yuzz Ofc?</button>
        </div>
      </div>
    `;
    return;
  }
  
  chatMessages.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function createMessageHTML(msg) {
  const isUser = msg.role === 'user';
  const avatarIcon = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
  
  let content = escapeHtml(msg.content);
  if (msg.image) {
    content += `<div class="message-image"><img src="${msg.image}" alt="Uploaded"></div>`;
  }
  
  return `
    <div class="message ${msg.role} ${msg.isError ? 'error' : ''}">
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-content">${content}</div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br>');
}

window.setInput = function(text) {
  msgInput.value = text;
  msgInput.focus();
};

// ========== API CALLS ==========
async function callOpenAI(messages) {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  return await res.json();
}

async function callGemini(messages) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  return await res.json();
}

// ========== SEND MESSAGE ==========
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || isProcessing) return;
  
  if (!activeConvId) {
    createNewConversation();
  }
  
  const conv = conversations.find(c => c.id === activeConvId);
  if (!conv) return;
  
  isProcessing = true;
  sendBtn.disabled = true;
  
  // Add user message
  conv.messages.push({ role: 'user', content: text });
  
  if (conv.messages.filter(m => m.role === 'user').length === 1) {
    conv.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
  }
  
  saveToStorage();
  renderMessages(conv.messages);
  renderSidebar();
  
  msgInput.value = '';
  
  // Typing indicator
  const typingId = 'typing-' + Date.now();
  chatMessages.insertAdjacentHTML('beforeend', `
    <div class="message assistant" id="${typingId}">
      <div class="message-avatar"><i class="fas fa-robot"></i></div>
      <div class="message-content">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>
    </div>
  `);
  
  try {
    const messages = conv.messages
      .filter(m => !m.image)
      .map(m => ({ role: m.role, content: m.content }));
    
    const response = activeModel === 'openai' 
      ? await callOpenAI(messages)
      : await callGemini(messages);
    
    document.getElementById(typingId)?.remove();
    
    conv.messages.push({
      role: 'assistant',
      content: response.content || 'Maaf, tidak ada respons.',
      isError: !response.success
    });
    
    saveToStorage();
    renderMessages(conv.messages);
    
  } catch (error) {
    document.getElementById(typingId)?.remove();
    conv.messages.push({
      role: 'assistant',
      content: `Error: ${error.message}`,
      isError: true
    });
    saveToStorage();
    renderMessages(conv.messages);
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    msgInput.focus();
  }
}

// ========== DELETE ==========
function deleteConversation(id) {
  conversations = conversations.filter(c => c.id !== id);
  saveToStorage();
  
  if (activeConvId === id) {
    if (conversations.length > 0) {
      switchConversation(conversations[0].id);
    } else {
      createNewConversation();
      switchConversation(activeConvId);
    }
  }
  
  renderSidebar();
}

// ========== EVENT LISTENERS ==========
hamburgerBtn?.addEventListener('click', () => {
  sidebar.classList.toggle('closed');
});

modelBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modelBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeModel = btn.dataset.model;
    modelBadge.innerHTML = activeModel === 'openai' 
      ? '<i class="fab fa-openai"></i> OpenAI'
      : '<i class="fas fa-gem"></i> Gemini';
  });
});

newChatBtn?.addEventListener('click', () => {
  createNewConversation();
  switchConversation(activeConvId);
  if (window.innerWidth <= 768) {
    sidebar.classList.add('closed');
  }
});

sendBtn?.addEventListener('click', sendMessage);

msgInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

clearAllBtn?.addEventListener('click', () => {
  if (confirm('Hapus semua percakapan?')) {
    localStorage.removeItem('youz_ai_conversations');
    conversations = [];
    createNewConversation();
    switchConversation(activeConvId);
  }
});

// ========== INIT ==========
loadFromStorage();
activeConvId = conversations[0]?.id;
renderSidebar();
if (activeConvId) {
  switchConversation(activeConvId);
}
