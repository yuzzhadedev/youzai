// ========== STATE ==========
let conversations = [];
let activeConversationId = null;
let activeModel = 'openai';
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

// ========== API CALLS ==========
const API = {
    async getConversations() {
        const res = await fetch('/api/conversations');
        const data = await res.json();
        return data;
    },
    
    async getConversation(id) {
        const res = await fetch(`/api/conversations/${id}`);
        const data = await res.json();
        return data;
    },
    
    async createConversation(title) {
        const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        const data = await res.json();
        return data;
    },
    
    async addMessage(convId, message) {
        const res = await fetch(`/api/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
        const data = await res.json();
        return data;
    },
    
    async deleteConversation(id) {
        const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        const data = await res.json();
        return data;
    },
    
    async deleteAllConversations() {
        const res = await fetch('/api/conversations', { method: 'DELETE' });
        const data = await res.json();
        return data;
    },
    
    async chatOpenAI(messages) {
        const res = await fetch('/api/openai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });
        const data = await res.json();
        return data;
    },
    
    async chatGemini(messages) {
        const res = await fetch('/api/gemini/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });
        const data = await res.json();
        return data;
    },
    
    async analyzeImage(imageData, prompt) {
        const res = await fetch('/api/gemini/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData, prompt })
        });
        const data = await res.json();
        return data;
    }
};

// ========== RENDER ==========
async function loadConversations() {
    const result = await API.getConversations();
    if (result.success) {
        conversations = result.data;
        renderSidebar();
    }
}

function renderSidebar() {
    if (conversations.length === 0) {
        conversationList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Belum ada percakapan</div>';
        return;
    }
    
    conversationList.innerHTML = conversations.map(conv => `
        <li class="conv-item ${conv.id === activeConversationId ? 'active' : ''}" data-id="${conv.id}">
            <i class="far fa-comment"></i>
            <span class="conv-title">${conv.title || 'Percakapan Baru'}</span>
            <i class="far fa-trash-alt delete-conv" data-id="${conv.id}"></i>
        </li>
    `).join('');
    
    // Add event listeners
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

async function switchConversation(id) {
    activeConversationId = id;
    
    const result = await API.getConversation(id);
    if (result.success) {
        const conv = result.data;
        chatTitle.textContent = conv.title || 'Percakapan Baru';
        renderMessages(conv.messages);
        renderSidebar();
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
                    <button class="suggestion-btn" onclick="setInput('🤖 Apa itu AI?')">🤖 Apa itu AI?</button>
                    <button class="suggestion-btn" onclick="setInput('✍️ Buat puisi')">✍️ Buat puisi</button>
                    <button class="suggestion-btn" onclick="setInput('💡 Tips produktif')">💡 Tips produktif</button>
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
    const modelLabel = msg.model ? ` (${msg.model === 'openai' ? 'OpenAI' : 'Gemini'})` : '';
    
    let content = escapeHtml(msg.content);
    if (msg.image) {
        content += `<div class="message-image"><img src="${msg.image}" alt="Uploaded"></div>`;
    }
    
    return `
        <div class="message ${msg.role} ${msg.isError ? 'error' : ''}">
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                ${content}
                ${!isUser && msg.model ? `<div style="font-size: 11px; margin-top: 8px; opacity: 0.6;">${modelLabel}</div>` : ''}
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

function setInput(text) {
    messageInput.value = text;
    messageInput.focus();
}

// ========== ACTIONS ==========
async function createNewChat() {
    const result = await API.createConversation('Percakapan Baru');
    if (result.success) {
        await loadConversations();
        activeConversationId = result.data.id;
        switchConversation(result.data.id);
    }
}

async function deleteConversation(id) {
    await API.deleteConversation(id);
    await loadConversations();
    
    if (activeConversationId === id) {
        if (conversations.length > 0) {
            switchConversation(conversations[0].id);
        } else {
            activeConversationId = null;
            chatTitle.textContent = 'Youz AI';
            renderMessages([]);
        }
    }
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isProcessing || !activeConversationId) return;
    
    isProcessing = true;
    sendBtn.disabled = true;
    
    // Add user message
    await API.addMessage(activeConversationId, {
        role: 'user',
        content: text
    });
    
    // Refresh conversation
    const convResult = await API.getConversation(activeConversationId);
    if (convResult.success) {
        renderMessages(convResult.data.messages);
    }
    
    messageInput.value = '';
    
    // Show typing indicator
    const typingId = 'typing-' + Date.now();
    chatMessages.insertAdjacentHTML('beforeend', `
        <div class="message assistant" id="${typingId}">
            <div class="message-avatar"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        // Get conversation messages for AI
        const currentConv = await API.getConversation(activeConversationId);
        const messages = currentConv.data.messages
            .filter(m => m.role !== 'system' && !m.image)
            .map(m => ({ role: m.role, content: m.content }));
        
        let aiResponse;
        if (activeModel === 'openai') {
            aiResponse = await API.chatOpenAI(messages);
        } else {
            aiResponse = await API.chatGemini(messages);
        }
        
        // Remove typing indicator
        document.getElementById(typingId)?.remove();
        
        if (aiResponse.success) {
            await API.addMessage(activeConversationId, {
                role: 'assistant',
                content: aiResponse.content,
                model: activeModel
            });
        } else {
            await API.addMessage(activeConversationId, {
                role: 'assistant',
                content: `❌ Error: ${aiResponse.error}`,
                isError: true
            });
        }
        
        // Refresh
        const updated = await API.getConversation(activeConversationId);
        if (updated.success) {
            renderMessages(updated.data.messages);
            chatTitle.textContent = updated.data.title || 'Percakapan Baru';
        }
        
        await loadConversations();
        
    } catch (error) {
        document.getElementById(typingId)?.remove();
        await API.addMessage(activeConversationId, {
            role: 'assistant',
            content: `❌ Error: ${error.message}`,
            isError: true
        });
        const updated = await API.getConversation(activeConversationId);
        if (updated.success) renderMessages(updated.data.messages);
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

async function handleImageUpload(file) {
    if (!file || !activeConversationId) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;
        
        // Add image message
        await API.addMessage(activeConversationId, {
            role: 'user',
            content: '[Mengunggah gambar...]',
            image: imageData
        });
        
        const convResult = await API.getConversation(activeConversationId);
        if (convResult.success) renderMessages(convResult.data.messages);
        
        // Analyze with Gemini
        const typingId = 'typing-' + Date.now();
        chatMessages.insertAdjacentHTML('beforeend', `
            <div class="message assistant" id="${typingId}">
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `);
        
        try {
            const result = await API.analyzeImage(imageData, 'Deskripsikan gambar ini dalam Bahasa Indonesia.');
            document.getElementById(typingId)?.remove();
            
            if (result.success) {
                await API.addMessage(activeConversationId, {
                    role: 'assistant',
                    content: `📷 ${result.content}`,
                    model: 'gemini'
                });
            } else {
                await API.addMessage(activeConversationId, {
                    role: 'assistant',
                    content: `❌ Gagal analisis: ${result.error}`,
                    isError: true
                });
            }
            
            const updated = await API.getConversation(activeConversationId);
            if (updated.success) renderMessages(updated.data.messages);
            
        } catch (error) {
            document.getElementById(typingId)?.remove();
            console.error('Image analysis error:', error);
        }
    };
    reader.readAsDataURL(file);
}

// ========== EVENT LISTENERS ==========
hamburgerBtn.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
});

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
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
        modelBadge.innerHTML = activeModel === 'openai' 
            ? '<i class="fab fa-openai"></i> OpenAI'
            : '<i class="fas fa-gem"></i> Gemini';
    });
});

newChatBtn.addEventListener('click', createNewChat);

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

attachBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
        imageInput.value = '';
    }
});

clearAllBtn.addEventListener('click', async () => {
    if (confirm('Hapus semua percakapan?')) {
        await API.deleteAllConversations();
        await loadConversations();
        activeConversationId = null;
        chatTitle.textContent = 'Youz AI';
        renderMessages([]);
        menuDropdown.classList.remove('show');
    }
});

aboutBtn.addEventListener('click', () => {
    alert('Youz AI v1.0\n\nAsisten AI dengan dual model: OpenAI & Gemini.\nDibuat oleh Yuzz Ofc.\n\n© 2024 Yuzz Ofc');
    menuDropdown.classList.remove('show');
});

// Close sidebar on mobile when clicking outside
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target) && !sidebar.classList.contains('closed')) {
            sidebar.classList.add('closed');
        }
    }
});

// Auto-resize on window
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('closed');
    }
});

// ========== INIT ==========
async function init() {
    await loadConversations();
    
    if (conversations.length > 0) {
        activeConversationId = conversations[0].id;
        switchConversation(activeConversationId);
    } else {
        await createNewChat();
    }
    
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
}

// Global function untuk suggestion buttons
window.setInput = setInput;

init();
