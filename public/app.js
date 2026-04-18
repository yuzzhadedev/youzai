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
        try {
            const res = await fetch('/api/conversations');
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('getConversations error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async getConversation(id) {
        try {
            const res = await fetch(`/api/conversations/${id}`);
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('getConversation error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async createConversation(title) {
        try {
            const res = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('createConversation error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async addMessage(convId, message) {
        try {
            const res = await fetch(`/api/conversations/${convId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('addMessage error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async deleteConversation(id) {
        try {
            const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('deleteConversation error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async deleteAllConversations() {
        try {
            const res = await fetch('/api/conversations', { method: 'DELETE' });
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('deleteAllConversations error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async chatOpenAI(messages) {
        try {
            const res = await fetch('/api/openai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('chatOpenAI error:', error);
            return { success: false, error: error.message, content: 'Gagal terhubung ke server.' };
        }
    },
    
    async chatGemini(messages) {
        try {
            const res = await fetch('/api/gemini/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('chatGemini error:', error);
            return { success: false, error: error.message, content: 'Gagal terhubung ke server.' };
        }
    },
    
    async analyzeImage(imageData, prompt) {
        try {
            const res = await fetch('/api/gemini/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageData, prompt })
            });
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('analyzeImage error:', error);
            return { success: false, error: error.message, content: 'Gagal menganalisis gambar.' };
        }
    }
};

// ========== RENDER FUNCTIONS ==========
async function loadConversations() {
    const result = await API.getConversations();
    if (result.success) {
        conversations = result.data;
        renderSidebar();
    }
}

function renderSidebar() {
    if (!conversations || conversations.length === 0) {
        conversationList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 14px;">Belum ada percakapan</div>';
        return;
    }
    
    conversationList.innerHTML = conversations.map(conv => `
        <li class="conv-item ${conv.id === activeConversationId ? 'active' : ''}" data-id="${conv.id}">
            <i class="far fa-comment"></i>
            <span class="conv-title">${escapeHtml(conv.title || 'Percakapan Baru')}</span>
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
    
    // Close sidebar on mobile
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
                    <button class="suggestion-btn" onclick="window.setInput('👤 Siapa Yuzz Ofc?')">👤 Siapa Yuzz Ofc?</button>
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
    const modelLabel = msg.model ? `<span style="font-size: 10px; opacity: 0.6; margin-left: 8px;">${msg.model === 'openai' ? 'OpenAI' : 'Gemini'}</span>` : '';
    
    let content = escapeHtml(msg.content);
    if (msg.image) {
        content += `<div class="message-image"><img src="${msg.image}" alt="Uploaded"></div>`;
    }
    
    const errorClass = msg.isError ? 'error' : '';
    
    return `
        <div class="message ${msg.role} ${errorClass}">
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                ${content}
                ${!isUser && msg.model ? modelLabel : ''}
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

// Global function untuk suggestion buttons
window.setInput = function(text) {
    messageInput.value = text;
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
};

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
    if (!confirm('Hapus percakapan ini?')) return;
    
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
    if (!text || isProcessing) return;
    
    // Jika belum ada percakapan, buat baru
    if (!activeConversationId) {
        await createNewChat();
    }
    
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
        chatTitle.textContent = convResult.data.title || 'Percakapan Baru';
    }
    
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
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
            .filter(m => !m.image && m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content }));
        
        let aiResponse;
        if (activeModel === 'openai') {
            aiResponse = await API.chatOpenAI(messages);
        } else {
            aiResponse = await API.chatGemini(messages);
        }
        
        // Remove typing indicator
        document.getElementById(typingId)?.remove();
        
        // Gunakan content dari response
        const responseContent = aiResponse.content || aiResponse.error || 'Maaf, tidak ada respons.';
        
        await API.addMessage(activeConversationId, {
            role: 'assistant',
            content: responseContent,
            model: activeModel,
            isError: !aiResponse.success
        });
        
        // Refresh messages
        const updated = await API.getConversation(activeConversationId);
        if (updated.success) {
            renderMessages(updated.data.messages);
            chatTitle.textContent = updated.data.title || 'Percakapan Baru';
        }
        
        // Refresh sidebar untuk update title
        await loadConversations();
        renderSidebar();
        
    } catch (error) {
        document.getElementById(typingId)?.remove();
        console.error('Send message error:', error);
        
        await API.addMessage(activeConversationId, {
            role: 'assistant',
            content: `❌ Error: ${error.message}`,
            isError: true
        });
        
        const updated = await API.getConversation(activeConversationId);
        if (updated.success) {
            renderMessages(updated.data.messages);
        }
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

async function handleImageUpload(file) {
    if (!file) return;
    
    // Jika belum ada percakapan, buat baru
    if (!activeConversationId) {
        await createNewChat();
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;
        
        // Add image message
        await API.addMessage(activeConversationId, {
            role: 'user',
            content: '📷 Mengunggah gambar...',
            image: imageData
        });
        
        const convResult = await API.getConversation(activeConversationId);
        if (convResult.success) {
            renderMessages(convResult.data.messages);
        }
        
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
            const result = await API.analyzeImage(imageData, 'Deskripsikan gambar ini secara detail dalam Bahasa Indonesia.');
            
            document.getElementById(typingId)?.remove();
            
            const responseContent = result.content || result.error || 'Gagal menganalisis gambar.';
            
            await API.addMessage(activeConversationId, {
                role: 'assistant',
                content: `📷 ${responseContent}`,
                model: 'gemini',
                isError: !result.success
            });
            
            const updated = await API.getConversation(activeConversationId);
            if (updated.success) {
                renderMessages(updated.data.messages);
            }
            
        } catch (error) {
            document.getElementById(typingId)?.remove();
            console.error('Image analysis error:', error);
            
            await API.addMessage(activeConversationId, {
                role: 'assistant',
                content: `❌ Gagal menganalisis gambar: ${error.message}`,
                isError: true
            });
            
            const updated = await API.getConversation(activeConversationId);
            if (updated.success) {
                renderMessages(updated.data.messages);
            }
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
    const rect = menuBtn.getBoundingClientRect();
    menuDropdown.style.top = (rect.bottom + 5) + 'px';
    menuDropdown.style.left = (rect.left - 180) + 'px';
    menuDropdown.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
        menuDropdown.classList.remove('show');
    }
});

// Model selector
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

// New chat
newChatBtn.addEventListener('click', async () => {
    await createNewChat();
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
});

// Send message
sendBtn.addEventListener('click', sendMessage);

// Enter to send
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Attach image
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

// Clear all conversations
clearAllBtn.addEventListener('click', async () => {
    if (confirm('Hapus SEMUA percakapan? Tindakan ini tidak dapat dibatalkan.')) {
        await API.deleteAllConversations();
        await loadConversations();
        activeConversationId = null;
        chatTitle.textContent = 'Youz AI';
        renderMessages([]);
        menuDropdown.classList.remove('show');
    }
});

// About
aboutBtn.addEventListener('click', () => {
    alert('Youz AI v1.0\n\nAsisten AI dengan dual model:\n• OpenAI GPT-3.5 Turbo\n• Google Gemini 2.0 Flash\n\nDibuat oleh Yuzz Ofc.\n\n© 2024 Yuzz Ofc. All rights reserved.');
    menuDropdown.classList.remove('show');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target) && !sidebar.classList.contains('closed')) {
            sidebar.classList.add('closed');
        }
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('closed');
    } else {
        if (!sidebar.classList.contains('closed')) {
            // Keep open if user hasn't closed it
        }
    }
});

// ========== INIT ==========
async function init() {
    await loadConversations();
    
    if (conversations.length > 0) {
        activeConversationId = conversations[0].id;
        await switchConversation(activeConversationId);
    } else {
        // Tampilkan empty state tanpa membuat percakapan
        renderMessages([]);
    }
    
    // Set initial model badge
    modelBadge.innerHTML = '<i class="fab fa-openai"></i> OpenAI';
    
    // Close sidebar on mobile by default
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
    
    console.log('✅ Youz AI initialized');
}

// Start app
init();
