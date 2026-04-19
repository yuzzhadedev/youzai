// ========== STATE ==========
let conversations = [];
let activeConversationId = null;
let activeModel = 'gpt4o';
let isProcessing = false;
let currentUser = null;
let typingTimeout = null;
let currentDraftImage = null;

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
const imageDraftContainer = document.getElementById('imageDraftContainer');
const draftImage = document.getElementById('draftImage');
const draftFileName = document.getElementById('draftFileName');
const draftFileSize = document.getElementById('draftFileSize');
const removeDraftBtn = document.getElementById('removeDraftBtn');

// ========== LOCALSTORAGE DATABASE ==========
function loadFromStorage() {
    const saved = localStorage.getItem('youz_ai_conversations');
    if (saved) {
        try { conversations = JSON.parse(saved); } catch (e) { conversations = []; }
    }
    if (conversations.length === 0) createNewConversation();
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
    if (userParam) {
        try {
            currentUser = JSON.parse(decodeURIComponent(userParam));
            localStorage.setItem('youz_user', JSON.stringify(currentUser));
            updateUserUI();
            window.history.replaceState({}, document.title, '/');
        } catch (e) {}
    } else {
        const savedUser = localStorage.getItem('youz_user');
        if (savedUser) {
            try { currentUser = JSON.parse(savedUser); updateUserUI(); } catch (e) {}
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

function login() { window.location.href = '/api/auth/login'; }
function logout() {
    localStorage.removeItem('youz_user');
    localStorage.removeItem('youz_ai_conversations');
    currentUser = null; conversations = [];
    updateUserUI(); createNewConversation(); renderSidebar(); renderMessages([]);
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
                e.stopPropagation(); deleteConversation(e.target.dataset.id);
            } else { switchConversation(item.dataset.id); }
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
    if (window.innerWidth <= 768) sidebar.classList.add('closed');
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-robot"></i></div>
                <h3>Youz AI</h3><p>Asisten AI cerdas buatan Yuzz Ofc</p>
                <div class="suggestions">
                    <button class="suggestion-btn" data-prompt="📅 Tanggal berapa hari ini?"><i class="far fa-calendar"></i> Tanggal hari ini?</button>
                    <button class="suggestion-btn" data-prompt="🔍 Cari berita terbaru tentang AI 2026"><i class="fas fa-newspaper"></i> Berita AI terbaru</button>
                    <button class="suggestion-btn" data-prompt="🎨 Generate gambar pemandangan"><i class="fas fa-paint-brush"></i> Generate gambar</button>
                </div>
            </div>`;
        document.querySelectorAll('.suggestion-btn').forEach(btn => btn.addEventListener('click', () => { messageInput.value = btn.dataset.prompt; sendMessage(); }));
        return;
    }
    chatMessages.innerHTML = '';
    messages.forEach((msg, index) => { const el = createMessageElement(msg, index); chatMessages.appendChild(el); });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function createMessageElement(msg, index) {
    const isUser = msg.role === 'user';
    const div = document.createElement('div');
    div.className = `message ${msg.role} ${msg.isError ? 'error' : ''}`;
    div.dataset.messageIndex = index;
    
    const avatarIcon = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    const modelNames = { 'gpt4o': '<i class="fas fa-robot"></i> ChatGPT', 'gemini': '<i class="fas fa-gem"></i> Gemini 2.5 Flash', 'web-search': '<i class="fas fa-globe"></i> Web Search', 'vision': '<i class="fas fa-eye"></i> Vision' };
    const modelLabel = !isUser && msg.model ? `<div style="font-size:11px;margin-top:8px;opacity:0.6;display:flex;align-items:center;gap:4px;">${modelNames[msg.model] || msg.model}</div>` : '';
    
    let content = escapeHtml(msg.content);
    if (msg.image) content += `<div class="message-image"><img src="${msg.image}" alt="Uploaded"></div>`;
    
    div.innerHTML = `
        <div class="message-avatar">${avatarIcon}</div>
        <div class="message-content-wrapper">
            <div class="message-content" id="msg-content-${index}">${content}${modelLabel}</div>
            ${!isUser && !msg.isError ? `
                <div class="message-actions">
                    <button class="action-btn copy-btn" data-content="${encodeURIComponent(msg.content)}"><i class="far fa-copy"></i><span>Salin</span></button>
                    <button class="action-btn like-btn ${msg.feedback === 'like' ? 'liked' : ''}" data-index="${index}"><i class="far fa-thumbs-up"></i><span>Suka</span></button>
                    <button class="action-btn dislike-btn ${msg.feedback === 'dislike' ? 'disliked' : ''}" data-index="${index}"><i class="far fa-thumbs-down"></i><span>Tidak Suka</span></button>
                    <button class="action-btn regenerate-btn" data-index="${index}"><i class="fas fa-redo-alt"></i><span>Ulang</span></button>
                </div>` : ''}
        </div>`;
    
    if (!isUser && !msg.isError) {
        div.querySelector('.copy-btn')?.addEventListener('click', (e) => copyMessage(msg.content, e.currentTarget));
        div.querySelector('.like-btn')?.addEventListener('click', () => handleFeedback(index, 'like'));
        div.querySelector('.dislike-btn')?.addEventListener('click', () => handleFeedback(index, 'dislike'));
        div.querySelector('.regenerate-btn')?.addEventListener('click', () => regenerateResponse(index));
    }
    return div;
}

function escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML.replace(/\n/g, '<br>'); }

// ========== IMAGE DRAFT ==========
function showImageDraft(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        currentDraftImage = { file, dataURL: e.target.result, fileName: file.name, fileSize: formatFileSize(file.size) };
        draftImage.src = e.target.result;
        draftFileName.textContent = file.name;
        draftFileSize.textContent = formatFileSize(file.size);
        imageDraftContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearImageDraft() {
    currentDraftImage = null;
    draftImage.src = '';
    imageDraftContainer.classList.add('hidden');
    imageInput.value = '';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// ========== MESSAGE ACTIONS ==========
async function copyMessage(content, btn) {
    try {
        await navigator.clipboard.writeText(content);
        btn.classList.add('copied'); btn.innerHTML = '<i class="fas fa-check"></i><span>Tersalin!</span>';
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<i class="far fa-copy"></i><span>Salin</span>'; }, 2000);
    } catch { alert('Gagal menyalin'); }
}

function handleFeedback(index, type) {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    const msg = conv.messages[index];
    if (!msg || msg.role !== 'assistant') return;
    msg.feedback = msg.feedback === type ? null : type;
    saveToStorage(); renderMessages(conv.messages);
}

async function regenerateResponse(index) {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    const msg = conv.messages[index];
    if (!msg || msg.role !== 'assistant') return;
    let userMsg = null;
    for (let i = index - 1; i >= 0; i--) if (conv.messages[i].role === 'user') { userMsg = conv.messages[i]; break; }
    if (!userMsg) { alert('Tidak dapat menemukan pertanyaan'); return; }
    conv.messages.splice(index, 1); saveToStorage(); renderMessages(conv.messages);
    messageInput.value = userMsg.content;
    if (userMsg.image) { currentDraftImage = { dataURL: userMsg.image }; showImageDraftFromData(userMsg.image); }
    await sendMessage();
}

// ========== ACTIONS ==========
function deleteConversation(id) {
    if (!confirm('Hapus percakapan ini?')) return;
    conversations = conversations.filter(c => c.id !== id); saveToStorage();
    if (activeConversationId === id) {
        if (conversations.length) switchConversation(conversations[0].id);
        else { createNewConversation(); switchConversation(activeConversationId); }
    }
    renderSidebar();
}

// ========== TIME ==========
function updateCurrentTime() {
    const now = new Date();
    const opts = { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    const fmt = new Intl.DateTimeFormat('id-ID', opts); const parts = fmt.formatToParts(now);
    let day = '', date = '', month = '', hour = '', minute = '';
    parts.forEach(p => { if (p.type === 'weekday') day = p.value; else if (p.type === 'day') date = p.value; else if (p.type === 'month') month = p.value; else if (p.type === 'hour') hour = p.value; else if (p.type === 'minute') minute = p.value; });
    if (currentTimeSpan) currentTimeSpan.textContent = `${day}, ${date} ${month} · ${hour}:${minute} WIB`;
}

// ========== MODEL ==========
function updateModelIndicator() {
    const ind = { 'gpt4o': '<i class="fas fa-robot"></i> ChatGPT', 'gemini': '<i class="fas fa-gem"></i> Gemini 2.5 Flash', 'search': '<i class="fas fa-globe"></i> Web Search' };
    if (modelIndicator) modelIndicator.innerHTML = ind[activeModel] || ind['gpt4o'];
}
modelOptionBtns.forEach(btn => btn.addEventListener('click', () => {
    modelOptionBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
    activeModel = btn.dataset.model; updateModelIndicator();
}));

// ========== API ==========
async function callAPI(messages, enableSearch = false, imageData = null) {
    const modelType = activeModel === 'gemini' ? 'gemini' : 'openai';
    const res = await fetch('/api/openai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, enableSearch, modelType, imageData, prompt: imageData ? 'Deskripsikan atau edit gambar ini.' : null })
    });
    return await res.json();
}

// ========== SEND MESSAGE ==========
async function sendMessage() {
    const text = messageInput.value.trim();
    if ((!text && !currentDraftImage) || isProcessing) return;
    if (!activeConversationId) createNewConversation();
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    
    isProcessing = true; sendBtn.disabled = true; searchSuggestions.classList.add('hidden');
    
    const userMsg = { id: 'msg-' + Date.now(), role: 'user', content: text || (currentDraftImage ? '📷 Edit/generate gambar' : '') };
    if (currentDraftImage) userMsg.image = currentDraftImage.dataURL;
    conv.messages.push(userMsg);
    if (conv.messages.filter(m => m.role === 'user').length === 1) conv.title = text.substring(0, 30) || 'Percakapan Gambar';
    saveToStorage(); renderMessages(conv.messages); renderSidebar();
    
    messageInput.value = ''; messageInput.style.height = 'auto';
    const draftWasPresent = !!currentDraftImage;
    clearImageDraft();
    
    const loadingId = 'loading-' + Date.now();
    chatMessages.insertAdjacentHTML('beforeend', `<div class="message assistant" id="${loadingId}"><div class="message-avatar"><i class="fas fa-robot"></i></div><div class="message-content"><div class="thinking-indicator"><i class="fas fa-spinner fa-pulse"></i><span>Thinking...</span></div></div></div>`);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        const messages = conv.messages.filter(m => !m.image).map(m => ({ role: m.role, content: m.content }));
        const enableSearch = activeModel === 'search';
        const response = await callAPI(messages, enableSearch, userMsg.image);
        
        document.getElementById(loadingId)?.remove();
        
        const aiMsg = { id: 'msg-' + Date.now(), role: 'assistant', content: '', model: enableSearch ? 'web-search' : (userMsg.image ? 'vision' : activeModel), isError: !response.success };
        conv.messages.push(aiMsg);
        renderMessages(conv.messages);
        
        const contentEl = document.getElementById(`msg-content-${conv.messages.length - 1}`);
        if (contentEl && response.success) {
            await typeWriterEffect(contentEl, response.content, 20);
            aiMsg.content = response.content;
        } else {
            aiMsg.content = response.content || 'Maaf, tidak ada respons.';
            if (contentEl) contentEl.innerHTML = escapeHtml(aiMsg.content);
        }
        saveToStorage();
    } catch (error) {
        document.getElementById(loadingId)?.remove();
        conv.messages.push({ id: 'msg-' + Date.now(), role: 'assistant', content: `❌ Error: ${error.message}`, isError: true });
        saveToStorage(); renderMessages(conv.messages);
    } finally {
        isProcessing = false; sendBtn.disabled = false; messageInput.focus();
    }
}

async function typeWriterEffect(el, text, speed = 20) {
    el.innerHTML = ''; let i = 0;
    return new Promise(resolve => {
        function type() {
            if (i < text.length) { el.innerHTML += text.charAt(i); i++; chatMessages.scrollTop = chatMessages.scrollHeight; typingTimeout = setTimeout(type, speed); }
            else { resolve(); }
        }
        type();
    });
}

// ========== EVENT LISTENERS ==========
hamburgerBtn?.addEventListener('click', () => sidebar.classList.toggle('closed'));
menuBtn?.addEventListener('click', (e) => { e.stopPropagation(); const r = menuBtn.getBoundingClientRect(); menuDropdown.style.top = (r.bottom + 5) + 'px'; menuDropdown.style.left = (r.left - 220) + 'px'; menuDropdown.classList.toggle('show'); });
document.addEventListener('click', (e) => { if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) menuDropdown.classList.remove('show'); if (!searchSuggestions.contains(e.target) && e.target !== messageInput) searchSuggestions.classList.add('hidden'); });
loginBtn?.addEventListener('click', login);
logoutBtn?.addEventListener('click', logout);
newChatBtn?.addEventListener('click', () => { createNewConversation(); switchConversation(activeConversationId); if (window.innerWidth <= 768) sidebar.classList.add('closed'); });
sendBtn?.addEventListener('click', sendMessage);
messageInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
messageInput?.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 150) + 'px'; });
attachBtn?.addEventListener('click', () => imageInput.click());
imageInput?.addEventListener('change', (e) => { if (e.target.files[0]) { showImageDraft(e.target.files[0]); } });
removeDraftBtn?.addEventListener('click', clearImageDraft);
clearAllBtn?.addEventListener('click', () => { if (confirm('Hapus SEMUA?')) { conversations = []; saveToStorage(); createNewConversation(); switchConversation(activeConversationId); menuDropdown.classList.remove('show'); } });
aboutBtn?.addEventListener('click', () => { alert('Youz AI v2.5\n\nChatGPT, Gemini 2.5 Flash, Vision, Image Generation.\nDibuat oleh Yuzz Ofc.'); menuDropdown.classList.remove('show'); });

// ========== INIT ==========
function init() {
    checkUserFromURL(); loadFromStorage();
    activeConversationId = conversations[0]?.id;
    renderSidebar();
    activeConversationId ? switchConversation(activeConversationId) : renderMessages([]);
    if (window.innerWidth <= 768) sidebar.classList.add('closed');
    updateCurrentTime(); setInterval(updateCurrentTime, 1000); updateModelIndicator();
}
init();
