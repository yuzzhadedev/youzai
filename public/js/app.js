// ========== STATE ==========
let conversations = [];
let activeConversationId = null;
let activeModel = 'openai'; // 'openai' sekarang = OpenRouter, 'gemini' = Gemini
let isProcessing = false;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const conversationList = document.getElementById('conversationList');
const chatMessages = document.getElementById('chatMessages');
const chatTitle = document.getElementById('chatTitle');
const modelBadge = document.getElementById('modelBadge');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const imageInput = document.getElementById('imageInput');
const modelBtns = document.querySelectorAll('.model-btn');
const newChatBtn = document.getElementById('newChatBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const aboutBtn = document.getElementById('aboutBtn');

// ========== LOCALSTORAGE DATABASE ==========
function loadFromStorage() {
    const saved = localStorage.getItem('youz_ai_conversations');
    if (saved) {
        try {
            conversations = JSON.parse(saved);
        } catch (e) {
            conversations = [];
        }
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    conversations.unshift(newConv);
    activeConversationId = newConv.id;
    saveToStorage();
    return newConv;
}

// ========== RENDER ==========
function renderSidebar() {
    if (!conversations.length) {
        conversationList.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">Belum ada percakapan</div>';
        return;
    }
    
    conversationList.innerHTML = conversations.map(conv => `
        <li class="conv-item ${conv.id === activeConversationId ? 'active' : ''}" data-id="${conv.id}">
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
    activeConversationId = id;
    const conv = conversations.find(c => c.id === id);
    if (conv) {
        chatTitle.textContent = conv.title || 'Percakapan Baru';
        renderMessages(conv.messages);
        renderSidebar();
        saveToStorage();
    }
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
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
                    <button class="suggestion-btn" onclick="window.setInput('🤖 Apa itu AI?')">🤖 Apa itu AI?</button>
                    <button class="suggestion-btn" onclick="window.setInput('✍️ Buat puisi tentang senja')">✍️ Buat puisi</button>
                    <button class="suggestion-btn" onclick="window.setInput('💡 Tips produktif sehari-hari')">💡 Tips produktif</button>
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
    
    let modelLabel = '';
    if (!isUser && msg.model) {
        if (msg.model === 'openrouter') {
            modelLabel = '<div style="font-size:11px;margin-top:8px;opacity:0.6;">OpenRouter</div>';
        } else if (msg.model === 'gemini') {
            modelLabel = '<div style="font-size:11px;margin-top:8px;opacity:0.6;">Gemini</div>';
        }
    }
    
    let content = escapeHtml(msg.content);
    if (msg.image) {
        content += `<div class="message-image"><img src="${msg.image}" alt="Uploaded"></div>`;
    }
    
    return `
        <div class="message ${msg.role} ${msg.isError ? 'error' : ''}">
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                ${content}
                ${modelLabel}
            </div>
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
    messageInput.value = text;
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
};

// ========== ACTIONS ==========
function deleteConversation(id) {
    if (!confirm('Hapus percakapan ini?')) return;
    
    conversations = conversations.filter(c => c.id !== id);
    saveToStorage();
    
    if (activeConversationId === id) {
        if (conversations.length > 0) {
            switchConversation(conversations[0].id);
        } else {
            createNewConversation();
            switchConversation(activeConversationId);
        }
    }
    
    renderSidebar();
}

// ========== API CALLS ==========
async function callOpenRouter(messages) {
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

async function analyzeImage(imageData) {
    const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, prompt: 'Deskripsikan gambar ini dalam Bahasa Indonesia.' })
    });
    return await res.json();
}

// ========== SEND MESSAGE ==========
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isProcessing) return;
    
    if (!activeConversationId) {
        createNewConversation();
    }
    
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    
    isProcessing = true;
    sendBtn.disabled = true;
    
    // Add user message
    conv.messages.push({ role: 'user', content: text });
    
    if (conv.messages.filter(m => m.role === 'user').length === 1) {
        conv.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
    }
    
    conv.updatedAt = new Date().toISOString();
    saveToStorage();
    renderMessages(conv.messages);
    renderSidebar();
    
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
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
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        const messages = conv.messages
            .filter(m => !m.image)
            .map(m => ({ role: m.role, content: m.content }));
        
        const response = activeModel === 'openai' 
            ? await callOpenRouter(messages)
            : await callGemini(messages);
        
        document.getElementById(typingId)?.remove();
        
        conv.messages.push({
            role: 'assistant',
            content: response.content || 'Maaf, tidak ada respons.',
            model: activeModel === 'openai' ? 'openrouter' : 'gemini',
            isError: !response.success
        });
        
        conv.updatedAt = new Date().toISOString();
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
        messageInput.focus();
    }
}

async function handleImageUpload(file) {
    if (!file) return;
    
    if (!activeConversationId) {
        createNewConversation();
    }
    
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;
        
        conv.messages.push({
            role: 'user',
            content: '📷 Mengunggah gambar...',
            image: imageData
        });
        
        saveToStorage();
        renderMessages(conv.messages);
        
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
            const result = await analyzeImage(imageData);
            document.getElementById(typingId)?.remove();
            
            conv.messages.push({
                role: 'assistant',
                content: `📷 ${result.content || 'Gagal menganalisis gambar.'}`,
                model: 'gemini',
                isError: !result.success
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
        }
    };
    reader.readAsDataURL(file);
}

// ========== EVENT LISTENERS ==========
hamburgerBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
});

menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = menuBtn.getBoundingClientRect();
    menuDropdown.style.top = (rect.bottom + 5) + 'px';
    menuDropdown.style.left = (rect.left - 180) + 'px';
    menuDropdown.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
        menuDropdown.classList.remove('show');
    }
});

modelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        modelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeModel = btn.dataset.model;
        
        // Update badge
        if (activeModel === 'openai') {
            modelBadge.innerHTML = '<i class="fas fa-robot"></i> OpenRouter';
        } else {
            modelBadge.innerHTML = '<i class="fas fa-gem"></i> Gemini';
        }
    });
});

newChatBtn?.addEventListener('click', () => {
    createNewConversation();
    switchConversation(activeConversationId);
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
});

sendBtn?.addEventListener('click', sendMessage);

messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

attachBtn?.addEventListener('click', () => {
    imageInput.click();
});

imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
        imageInput.value = '';
    }
});

clearAllBtn?.addEventListener('click', () => {
    if (confirm('Hapus SEMUA percakapan?')) {
        localStorage.removeItem('youz_ai_conversations');
        conversations = [];
        createNewConversation();
        switchConversation(activeConversationId);
        menuDropdown.classList.remove('show');
    }
});

aboutBtn?.addEventListener('click', () => {
    alert('Youz AI v1.0\n\nAsisten AI dengan:\n• OpenRouter (Google Gemini Flash - Gratis)\n• Google Gemini 2.0 Flash\n\nDibuat oleh Yuzz Ofc.\n\n© 2024 Yuzz Ofc');
    menuDropdown.classList.remove('show');
});

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target) && !sidebar.classList.contains('closed')) {
            sidebar.classList.add('closed');
        }
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('closed');
    }
});

// ========== INIT ==========
function init() {
    loadFromStorage();
    activeConversationId = conversations[0]?.id;
    renderSidebar();
    if (activeConversationId) {
        switchConversation(activeConversationId);
    }
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
    
    // Set default badge
    modelBadge.innerHTML = '<i class="fas fa-robot"></i> OpenRouter';
    
    console.log('✅ Youz AI initialized');
}

init();
