// ========== STATE ==========
let conversations = [];
let activeConversationId = null;
let activeModel = 'gpt4o'; // 'gpt4o', 'gemini', 'search'
let isProcessing = false;
let currentUser = null;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const conversationList = document.getElementById('conversationList');
const chatMessages = document.getElementById('chatMessages');
const chatTitle = document.getElementById('chatTitle');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const imageInput = document.getElementById('imageInput');
const newChatBtn = document.getElementById('newChatBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const aboutBtn = document.getElementById('aboutBtn');
const loginBtn = document.getElementById('loginBtn');
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const currentTimeSpan = document.getElementById('currentTime');
const searchSuggestions = document.getElementById('searchSuggestions');
const modelOptionBtns = document.querySelectorAll('.model-option-btn');
const modelIndicator = document.getElementById('modelIndicator');

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
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
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

// ========== USER AUTH ==========
function checkUserFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    const error = urlParams.get('error');
    
    if (error) {
        console.error('Login error:', error);
        return;
    }
    
    if (userParam) {
        try {
            currentUser = JSON.parse(decodeURIComponent(userParam));
            localStorage.setItem('youz_user', JSON.stringify(currentUser));
            updateUserUI();
            window.history.replaceState({}, document.title, '/');
        } catch (e) {
            console.error('Failed to parse user data');
        }
    } else {
        const savedUser = localStorage.getItem('youz_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                updateUserUI();
            } catch (e) {}
        }
    }
}

function updateUserUI() {
    if (currentUser) {
        loginBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
        userAvatar.src = currentUser.picture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name || 'User') + '&background=3b82f6&color=fff';
        userName.textContent = currentUser.name || 'User';
        userEmail.textContent = currentUser.email || '';
    } else {
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
    }
}

function login() {
    window.location.href = '/api/auth/login';
}

function logout() {
    localStorage.removeItem('youz_user');
    localStorage.removeItem('youz_ai_conversations');
    currentUser = null;
    conversations = [];
    updateUserUI();
    createNewConversation();
    renderSidebar();
    renderMessages([]);
    window.location.href = '/api/auth/logout';
}

// ========== RENDER ==========
function renderSidebar() {
    if (!conversations.length) {
        conversationList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">Belum ada percakapan</div>';
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
                <div class="empty-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h3>Youz AI</h3>
                <p>Asisten AI cerdas buatan Yuzz Ofc</p>
                <div class="suggestions">
                    <button class="suggestion-btn" data-prompt="📅 Tanggal berapa hari ini?">
                        <i class="far fa-calendar"></i> Tanggal hari ini?
                    </button>
                    <button class="suggestion-btn" data-prompt="⏰ Jam berapa sekarang?">
                        <i class="far fa-clock"></i> Jam berapa?
                    </button>
                    <button class="suggestion-btn" data-prompt="🔍 Cari berita terbaru tentang AI 2026">
                        <i class="fas fa-newspaper"></i> Berita AI terbaru
                    </button>
                    <button class="suggestion-btn" data-prompt="🤖 Apa itu kecerdasan buatan?">
                        <i class="fas fa-brain"></i> Apa itu AI?
                    </button>
                    <button class="suggestion-btn" data-prompt="✍️ Buatkan puisi tentang teknologi">
                        <i class="fas fa-pen"></i> Buat puisi
                    </button>
                    <button class="suggestion-btn" data-prompt="💡 Tips produktif untuk programmer">
                        <i class="fas fa-lightbulb"></i> Tips produktif
                    </button>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                messageInput.value = btn.dataset.prompt;
                sendMessage();
            });
        });
        return;
    }
    
    chatMessages.innerHTML = '';
    messages.forEach((msg, index) => {
        const messageEl = createMessageElement(msg, index);
        chatMessages.appendChild(messageEl);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function createMessageElement(msg, index) {
    const isUser = msg.role === 'user';
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.role} ${msg.isError ? 'error' : ''}`;
    messageDiv.dataset.messageIndex = index;
    messageDiv.dataset.messageId = msg.id || `msg-${Date.now()}-${index}`;
    
    const avatarIcon = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    
    let modelLabel = '';
    if (!isUser && msg.model) {
        const modelNames = {
            'gpt4o': '<i class="fas fa-robot"></i> GPT-4o',
            'gemini': '<i class="fas fa-gem"></i> Gemini Flash',
            'web-search': '<i class="fas fa-globe"></i> Web Search',
            'search': '<i class="fas fa-globe"></i> Web Search',
            'vision': '<i class="fas fa-eye"></i> Vision',
            'chatgpt': '<i class="fas fa-robot"></i> ChatGPT'
        };
        const displayModel = modelNames[msg.model] || msg.model;
        modelLabel = `<div style="font-size:11px;margin-top:8px;opacity:0.6;display:flex;align-items:center;gap:4px;">${displayModel}</div>`;
    }
    
    let content = escapeHtml(msg.content);
    if (msg.image) {
        content += `<div class="message-image"><img src="${msg.image}" alt="Uploaded"></div>`;
    }
    
    // Feedback indicator
    let feedbackIndicator = '';
    if (msg.feedback === 'like') {
        feedbackIndicator = '<span class="feedback-indicator"><i class="fas fa-thumbs-up"></i> Disukai</span>';
    } else if (msg.feedback === 'dislike') {
        feedbackIndicator = '<span class="feedback-indicator"><i class="fas fa-thumbs-down"></i> Tidak disukai</span>';
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarIcon}</div>
        <div class="message-content-wrapper">
            <div class="message-content">
                ${content}
                ${modelLabel}
            </div>
            ${!isUser && !msg.isError ? `
                <div class="message-actions">
                    <button class="action-btn copy-btn" data-content="${encodeURIComponent(msg.content)}" title="Salin">
                        <i class="far fa-copy"></i>
                        <span>Salin</span>
                    </button>
                    <button class="action-btn like-btn ${msg.feedback === 'like' ? 'liked' : ''}" data-index="${index}" title="Suka">
                        <i class="far fa-thumbs-up"></i>
                        <span>Suka</span>
                    </button>
                    <button class="action-btn dislike-btn ${msg.feedback === 'dislike' ? 'disliked' : ''}" data-index="${index}" title="Tidak Suka">
                        <i class="far fa-thumbs-down"></i>
                        <span>Tidak Suka</span>
                    </button>
                    <button class="action-btn regenerate-btn" data-index="${index}" title="Respon Ulang">
                        <i class="fas fa-redo-alt"></i>
                        <span>Ulang</span>
                    </button>
                    ${feedbackIndicator}
                </div>
            ` : ''}
        </div>
    `;
    
    // Attach event listeners
    if (!isUser && !msg.isError) {
        const copyBtn = messageDiv.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => copyMessage(msg.content, copyBtn));
        
        const likeBtn = messageDiv.querySelector('.like-btn');
        likeBtn.addEventListener('click', () => handleFeedback(index, 'like'));
        
        const dislikeBtn = messageDiv.querySelector('.dislike-btn');
        dislikeBtn.addEventListener('click', () => handleFeedback(index, 'dislike'));
        
        const regenerateBtn = messageDiv.querySelector('.regenerate-btn');
        regenerateBtn.addEventListener('click', () => regenerateResponse(index));
    }
    
    return messageDiv;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// ========== MESSAGE ACTIONS ==========
async function copyMessage(content, btn) {
    try {
        await navigator.clipboard.writeText(content);
        
        // Visual feedback
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fas fa-check"></i><span>Tersalin!</span>';
        
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="far fa-copy"></i><span>Salin</span>';
        }, 2000);
        
        // Optional: Show toast
        console.log('✅ Pesan disalin');
    } catch (err) {
        console.error('Gagal menyalin:', err);
        alert('Gagal menyalin pesan');
    }
}

function handleFeedback(messageIndex, type) {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    
    const message = conv.messages[messageIndex];
    if (!message || message.role !== 'assistant') return;
    
    // Toggle feedback
    if (message.feedback === type) {
        message.feedback = null;
    } else {
        message.feedback = type;
    }
    
    saveToStorage();
    renderMessages(conv.messages);
    
    // Optional: Send feedback to server
    console.log(`📝 Feedback: ${type} untuk pesan #${messageIndex}`);
}

async function regenerateResponse(messageIndex) {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    
    const message = conv.messages[messageIndex];
    if (!message || message.role !== 'assistant') return;
    
    // Cari pesan user sebelum AI ini
    let userMessage = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
        if (conv.messages[i].role === 'user') {
            userMessage = conv.messages[i];
            break;
        }
    }
    
    if (!userMessage) {
        alert('Tidak dapat menemukan pertanyaan untuk direspon ulang.');
        return;
    }
    
    // Hapus pesan AI yang akan diregenerate
    conv.messages.splice(messageIndex, 1);
    
    // Hapus juga pesan setelahnya jika ada (opsional)
    // conv.messages = conv.messages.slice(0, messageIndex);
    
    saveToStorage();
    renderMessages(conv.messages);
    
    // Kirim ulang pertanyaan user
    messageInput.value = userMessage.content;
    await sendMessage();
}

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

// ========== TIME UPDATE ==========
function updateCurrentTime() {
    const now = new Date();
    const options = { 
        timeZone: 'Asia/Jakarta',
        weekday: 'short', 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit', 
        minute: '2-digit'
    };
    const formatter = new Intl.DateTimeFormat('id-ID', options);
    const parts = formatter.formatToParts(now);
    
    let dayName = '', date = '', month = '', hour = '', minute = '';
    parts.forEach(part => {
        if (part.type === 'weekday') dayName = part.value;
        if (part.type === 'day') date = part.value;
        if (part.type === 'month') month = part.value;
        if (part.type === 'hour') hour = part.value;
        if (part.type === 'minute') minute = part.value;
    });
    
    if (currentTimeSpan) {
        currentTimeSpan.textContent = `${dayName}, ${date} ${month} · ${hour}:${minute} WIB`;
    }
}

// ========== MODEL SELECTOR ==========
function updateModelIndicator() {
    const indicators = {
        'gpt4o': '<i class="fas fa-robot"></i> ChatGPT',
        'gemini': '<i class="fas fa-gem"></i> Gemini Flash',
        'search': '<i class="fas fa-globe"></i> Web Search'
    };
    if (modelIndicator) {
        modelIndicator.innerHTML = indicators[activeModel] || indicators['gpt4o'];
    }
}

modelOptionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        modelOptionBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeModel = btn.dataset.model;
        updateModelIndicator();
    });
});

// ========== API CALLS ==========
async function callOpenRouter(messages, enableSearch = false) {
    const res = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, enableSearch })
    });
    return await res.json();
}

async function callOpenRouterVision(imageData, prompt) {
    const res = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, prompt })
    });
    return await res.json();
}

async function callGeminiAPI(messages) {
    const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
    });
    return await res.json();
}

async function callGeminiVision(imageData) {
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
    searchSuggestions.classList.add('hidden');
    
    const userMessage = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        role: 'user',
        content: text
    };
    
    conv.messages.push(userMessage);
    
    if (conv.messages.filter(m => m.role === 'user').length === 1) {
        conv.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
    }
    
    conv.updatedAt = new Date().toISOString();
    saveToStorage();
    renderMessages(conv.messages);
    renderSidebar();
    
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
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
        
        let response;
        const enableSearch = activeModel === 'search';
        
        if (activeModel === 'gemini') {
            response = await callGeminiAPI(messages);
        } else {
            response = await callOpenRouter(messages, enableSearch);
        }
        
        document.getElementById(typingId)?.remove();
        
        const aiMessage = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            role: 'assistant',
            content: response.content || 'Maaf, tidak ada respons.',
            model: enableSearch ? 'web-search' : (activeModel === 'gemini' ? 'gemini' : 'chatgpt'),
            isError: !response.success,
            feedback: null
        };
        
        conv.messages.push(aiMessage);
        
        conv.updatedAt = new Date().toISOString();
        saveToStorage();
        renderMessages(conv.messages);
        
    } catch (error) {
        document.getElementById(typingId)?.remove();
        conv.messages.push({
            id: 'msg-' + Date.now(),
            role: 'assistant',
            content: `❌ Error: ${error.message}`,
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

// ========== IMAGE UPLOAD ==========
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
            id: 'msg-' + Date.now(),
            role: 'user',
            content: '📷 Menganalisis gambar...',
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
            let result;
            if (activeModel === 'gemini') {
                result = await callGeminiVision(imageData);
            } else {
                result = await callOpenRouterVision(imageData, 'Deskripsikan gambar ini secara detail dalam Bahasa Indonesia.');
            }
            
            document.getElementById(typingId)?.remove();
            
            conv.messages.push({
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: `📷 ${result.content || 'Gagal menganalisis gambar.'}`,
                model: 'vision',
                isError: !result.success,
                feedback: null
            });
            
            saveToStorage();
            renderMessages(conv.messages);
            
        } catch (error) {
            document.getElementById(typingId)?.remove();
            conv.messages.push({
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: `❌ Error: ${error.message}`,
                isError: true
            });
            saveToStorage();
            renderMessages(conv.messages);
        }
    };
    reader.readAsDataURL(file);
}

// ========== SEARCH SUGGESTIONS ==========
messageInput.addEventListener('input', function() {
    const query = this.value.trim();
    if (query.length > 2) {
        searchSuggestions.classList.remove('hidden');
        const suggestionItems = searchSuggestions.querySelectorAll('.suggestion-item');
        if (suggestionItems.length > 0) {
            suggestionItems[0].setAttribute('data-query', `${query} berita terbaru`);
            suggestionItems[0].innerHTML = `<i class="fas fa-newspaper"></i><span>"${query}" berita terbaru</span>`;
            suggestionItems[1].setAttribute('data-query', `${query} penjelasan`);
            suggestionItems[1].innerHTML = `<i class="fas fa-search"></i><span>"${query}" penjelasan</span>`;
        }
    } else {
        searchSuggestions.classList.add('hidden');
    }
});

document.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
        messageInput.value = item.dataset.query;
        searchSuggestions.classList.add('hidden');
        sendMessage();
    });
});

// ========== EVENT LISTENERS ==========
hamburgerBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
});

menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = menuBtn.getBoundingClientRect();
    menuDropdown.style.top = (rect.bottom + 5) + 'px';
    menuDropdown.style.left = (rect.left - 220) + 'px';
    menuDropdown.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
        menuDropdown.classList.remove('show');
    }
    if (!searchSuggestions.contains(e.target) && e.target !== messageInput) {
        searchSuggestions.classList.add('hidden');
    }
});

loginBtn?.addEventListener('click', login);
logoutBtn?.addEventListener('click', logout);

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
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
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
    if (confirm('Hapus SEMUA percakapan? Tindakan ini tidak dapat dibatalkan.')) {
        conversations = [];
        saveToStorage();
        createNewConversation();
        switchConversation(activeConversationId);
        menuDropdown.classList.remove('show');
    }
});

aboutBtn?.addEventListener('click', () => {
    alert('Youz AI v2.1\n\nAsisten AI cerdas dengan:\n• ChatGPT (via OpenRouter)\n• Gemini Flash\n• Web Search Mode\n• Vision Support\n• Salin, Like, Dislike, Regenerate\n\nDibuat oleh Yuzz Ofc.\n\n© 2026 Yuzz Ofc');
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
    checkUserFromURL();
    loadFromStorage();
    activeConversationId = conversations[0]?.id;
    renderSidebar();
    if (activeConversationId) {
        switchConversation(activeConversationId);
    } else {
        renderMessages([]);
    }
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
    
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    updateModelIndicator();
    
    console.log('✅ Youz AI v2.1 initialized');
}

init();