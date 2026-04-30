// ========== STATE ==========
let conversations = [];
let activeConversationId = null;
let activeModel = 'gpt4o'; // 'gpt4o', 'gemini'
let isProcessing = false;
let currentUser = null;
let abortController = null;
let autoScrollDuringTyping = true;
let activeSources = [];
let typingAbortRequested = false;
// ========== FITUR BARU: STATE TAMBAHAN ==========
let webSearchEnabled = true;
let thinkingModeEnabled = false;
let typingTimeout = null;
let currentDraftImage = null; // { file, dataURL, fileName, fileSize }
let quotaState = null;

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
const modelSelect = document.getElementById('modelSelect');
const modelSelectBtn = document.getElementById('modelSelectBtn');
const modelSelectBtnText = document.getElementById('modelSelectBtnText');
const modelSelectPanel = document.getElementById('modelSelectPanel');
const toolsBtn = document.getElementById('toolsBtn');
const toolsMenu = document.getElementById('toolsMenu');
const toolWebSearch = document.getElementById('toolWebSearch');
const toolThinking = document.getElementById('toolThinking');
const imageInput = document.getElementById('imageInput');
const newChatBtn = document.getElementById('newChatBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const aboutBtn = document.getElementById('aboutBtn');
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const userMenuBtn = document.getElementById('userMenuBtn');
const userMenuDropdown = document.getElementById('userMenuDropdown');
const userSettingsBtn = document.getElementById('userSettingsBtn');
const userProfileBtn = document.getElementById('userProfileBtn');
const userPremiumBtn = document.getElementById('userPremiumBtn');
const userLogoutBtn = document.getElementById('userLogoutBtn');
const currentTimeSpan = document.getElementById('currentTime');
const searchSuggestions = document.getElementById('searchSuggestions');
const modelIndicator = document.getElementById('modelIndicator');
const quotaBadge = document.getElementById('quotaBadge');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
// ========== FITUR BARU: DOM ELEMENTS TAMBAHAN ==========
const imageDraftContainer = document.getElementById('imageDraftContainer');
const draftImage = document.getElementById('draftImage');
const draftFileName = document.getElementById('draftFileName');
const draftFileSize = document.getElementById('draftFileSize');
const removeDraftBtn = document.getElementById('removeDraftBtn');
const sourcesSheet = document.getElementById('sourcesSheet');
const sourcesBackdrop = document.getElementById('sourcesBackdrop');
const sourcesList = document.getElementById('sourcesList');
// ========== TAMBAHAN: HEADER NEW CHAT BUTTON ==========
const headerNewChatBtn = document.getElementById('headerNewChatBtn');

// ========== TAMBAHAN: SIDEBAR LINKS & SETTINGS ==========
const settingsModal = document.getElementById('settingsModal');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const tabGeneral = document.getElementById('tabGeneral');
const tabProfile = document.getElementById('tabProfile');
const tabData = document.getElementById('tabData');
const generalContent = document.getElementById('generalContent');
const profileContent = document.getElementById('profileContent');
const dataContent = document.getElementById('dataContent');
const themeLight = document.getElementById('themeLight');
const themeDark = document.getElementById('themeDark');
const themeSystem = document.getElementById('themeSystem');
const languageSelect = document.getElementById('languageSelect');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const clearAllDataBtn = document.getElementById('clearAllDataBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const settingsModelBtns = document.querySelectorAll('.settings-model-btn');
const webSearchToggle = document.getElementById('webSearchToggle');
const sidebarAuthLinks = document.getElementById('sidebarAuthLinks');
const sidebarAuthRequiredLinks = document.querySelectorAll('.sidebar-link.requires-auth');

// Language state
let currentLanguage = localStorage.getItem('youz_language') || 'id';
let isTouchingChat = false;
let scrollPauseTimer = null;

// ========== LOCALSTORAGE DATABASE ==========
function loadFromStorage() {
    const saved = localStorage.getItem(getConversationStorageKey());
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
    localStorage.setItem(getConversationStorageKey(), JSON.stringify(conversations));
}

function getConversationStorageKey() {
    const userKey = currentUser?.email || currentUser?.id || 'guest';
    return `youz_ai_conversations_${String(userKey).toLowerCase()}`;
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

async function syncUserFromServer() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await readApiResponse(res);
        if (data?.authenticated && data.user) {
            currentUser = data.user;
            localStorage.setItem('youz_user', JSON.stringify(currentUser));
            updateUserUI();
            return;
        }
        if (!localStorage.getItem('youz_user')) {
            currentUser = null;
            updateUserUI();
        }
    } catch (error) {
        console.warn('Auth sync skipped:', error?.message || error);
    }
}

function updateUserUI() {
    if (currentUser) { 
        userProfile.classList.remove('hidden');
        sidebarAuthLinks?.classList.add('hidden');
        userMenuDropdown?.classList.add('hidden');
        sidebarAuthLinks?.classList.add('hidden');
        sidebarAuthRequiredLinks.forEach(link => link.classList.remove('hidden'));
        userAvatar.src = currentUser.picture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name || 'User') + '&background=3b82f6&color=fff';
        userName.textContent = currentUser.name || 'User';
        userEmail.textContent = currentUser.email || '';
    } else {
        userProfile.classList.add('hidden');
        sidebarAuthLinks?.classList.remove('hidden');
        userMenuDropdown?.classList.add('hidden');
        sidebarAuthRequiredLinks.forEach(link => link.classList.add('hidden'));
    }
}

function logout() {
    localStorage.removeItem('youz_user');
    currentUser = null;
    updateUserUI();
    loadFromStorage();
    activeConversationId = conversations[0]?.id;
    renderSidebar();
    if (activeConversationId) switchConversation(activeConversationId);
    window.location.href = '/api/auth/logout';
}

function toggleUserMenu(forceShow = null) {
    if (!userMenuDropdown || !currentUser) return;
    const nextShow = forceShow === null ? userMenuDropdown.classList.contains('hidden') : forceShow;
    userMenuDropdown.classList.toggle('hidden', !nextShow);
}

function updateScrollBottomVisibility() {
    if (!chatMessages || !scrollBottomBtn) return;
    const distanceFromBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
    const shouldShow = distanceFromBottom > 140 && !isTouchingChat;
    scrollBottomBtn.classList.toggle('hidden', !shouldShow);
}

function shouldStickToBottom() {
    if (!chatMessages) return true;
    const distance = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
    return distance < 120;
}

function setProcessingUI(processing) {
    if (!sendBtn) return;
    sendBtn.classList.toggle('stop', processing);
    sendBtn.title = processing ? 'Stop' : 'Kirim';
    sendBtn.setAttribute('aria-label', processing ? 'Stop' : 'Kirim');
    const sendText = currentLanguage === 'en' ? 'Send Message' : 'Kirim Pesan';
    sendBtn.innerHTML = processing
        ? '<i class="fas fa-stop"></i>'
        : '<i class="fas fa-arrow-up"></i>';
}

function openSourcesSheet(sources = [], focusIndex = 0) {
    if (!sourcesList || !sourcesSheet) return;
    activeSources = sources;
    sourcesList.innerHTML = !sources.length
        ? '<p>Tidak ada sumber.</p>'
        : sources.map((source) => `
            <div class="source-item">
                <a href="${source.url}" target="_blank" rel="noopener noreferrer"><img src="${getSourceFaviconUrl(source.url)}" alt="" loading="lazy">${escapeHtml(source.title || source.url)}</a>
                <p>${escapeHtml(source.snippet || source.url)}</p>
            </div>
        `).join('');
    sourcesSheet.classList.remove('hidden');
    const sourceItems = sourcesList.querySelectorAll('.source-item');
    if (sourceItems[focusIndex]) {
        sourceItems[focusIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function closeSourcesSheet() {
    sourcesSheet?.classList.add('hidden');
}

function openSettings(defaultTab = 'general') {
    settingsModal.classList.remove('hidden');
    sidebar.classList.add('closed');
    if (currentUser) {
        profileName.value = currentUser.name || '';
        profileEmail.value = currentUser.email || '';
    }
    languageSelect.value = currentLanguage;
    if (defaultTab === 'profile') {
        tabProfile?.click();
    } else if (defaultTab === 'data') {
        tabData?.click();
    } else {
        tabGeneral?.click();
    }
}

// ========== RENDER ==========
function renderSidebar() {
    if (!conversations.length) {
        conversationList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">Belum ada percakapan</div>';
        return;
    }

    const now = new Date();
    const grouped = {
        today: [],
        yesterday: [],
        sevenDays: [],
        thirtyDays: []
    };

    conversations.forEach((conv) => {
        const sourceDate = conv.updatedAt || conv.createdAt;
        const convDate = sourceDate ? new Date(sourceDate) : now;
        const diff = Math.floor((now - convDate) / (1000 * 60 * 60 * 24));
        if (diff <= 0) grouped.today.push(conv);
        else if (diff === 1) grouped.yesterday.push(conv);
        else if (diff <= 7) grouped.sevenDays.push(conv);
        else if (diff <= 30) grouped.thirtyDays.push(conv);
    });

    const i18n = currentLanguage === 'en'
        ? { today: 'Today', yesterday: 'Yesterday', sevenDays: 'Previous 7 days', thirtyDays: 'Previous 30 days' }
        : { today: 'Hari ini', yesterday: 'Kemarin', sevenDays: '7 hari terakhir', thirtyDays: '30 hari terakhir' };

    const groupHtml = (title, items) => {
        if (!items.length) return '';
        return `
            <li class="history-group">${title}</li>
            ${items.map(conv => `
                <li class="conv-item ${conv.id === activeConversationId ? 'active' : ''}" data-id="${conv.id}">
                    <i class="far fa-comment"></i>
                    <span class="conv-title">${escapeHtml(conv.title || 'Percakapan Baru')}</span>
                    <i class="far fa-trash-alt delete-conv" data-id="${conv.id}"></i>
                </li>
            `).join('')}
            `;
    };

    conversationList.innerHTML = [
        groupHtml(i18n.today, grouped.today),
        groupHtml(i18n.yesterday, grouped.yesterday),
        groupHtml(i18n.sevenDays, grouped.sevenDays),
        groupHtml(i18n.thirtyDays, grouped.thirtyDays)
    ].join('');
    
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
                    <img src="/login/logo.png" alt="Youz AI Logo">
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
    messageDiv.className = `message ${msg.role} ${msg.isError ? 'error' : ''} ${msg.isComplete === false ? 'pending' : ''}`;
    messageDiv.dataset.messageIndex = index;
    messageDiv.dataset.messageId = msg.id || `msg-${Date.now()}-${index}`;
    
    const avatarIcon = isUser ? '<i class="fas fa-user"></i>' : '<img src="/login/logo.png" alt="Youz AI">';
    
    let content = renderMessageContent(msg.content);
    if (msg.image) {
        content += `<div class="message-image"><img src="${msg.image}" alt="Uploaded"></div>`;
    }
    if (msg.generatedImage) {
        content = `<strong>Gambar telah dibuat</strong><br>${content}<div class="message-image"><img src="${msg.generatedImage}" alt="Generated"></div>`;
    }
    
    let feedbackIndicator = '';
    if (msg.feedback === 'like') {
        feedbackIndicator = '<span class="feedback-indicator"><i class="fas fa-thumbs-up"></i> Disukai</span>';
    } else if (msg.feedback === 'dislike') {
        feedbackIndicator = '<span class="feedback-indicator"><i class="fas fa-thumbs-down"></i> Tidak disukai</span>';
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarIcon}</div>
        <div class="message-content-wrapper">
            <div class="message-content" id="msg-content-${index}">
                ${content}
            </div>
            ${!isUser && !msg.isError ? `
                <div class="message-actions">
                    <button class="action-btn copy-btn" data-content="${encodeURIComponent(msg.content || '')}" title="Salin" ${msg.isComplete === false ? 'disabled' : ''}>
                        <i class="far fa-copy"></i>
                        <span>Salin</span>
                    </button>
                    <button class="action-btn like-btn ${msg.feedback === 'like' ? 'liked' : ''}" data-index="${index}" title="Suka" ${msg.isComplete === false ? 'disabled' : ''}>
                        <i class="far fa-thumbs-up"></i>
                        <span>Suka</span>
                    </button>
                    <button class="action-btn dislike-btn ${msg.feedback === 'dislike' ? 'disliked' : ''}" data-index="${index}" title="Tidak Suka" ${msg.isComplete === false ? 'disabled' : ''}>
                        <i class="far fa-thumbs-down"></i>
                        <span>Tidak Suka</span>
                    </button>
                    <button class="action-btn regenerate-btn" data-index="${index}" title="Respon Ulang" ${msg.isComplete === false ? 'disabled' : ''}>
                        <i class="fas fa-redo-alt"></i>
                        <span>Ulang</span>
                    </button>
                    ${msg.sources?.length ? `
                    <button class="action-btn sources-btn has-sources" type="button" title="Sumber" data-index="${index}">
                        <span class="source-logo-stack">${(msg.sources || []).slice(0,3).map(source => `<img src="${getSourceFaviconUrl(source.url)}" alt="" loading="lazy">`).join('')}</span>
                        <span>Sumber</span>
                    </button>` : ''}
                    ${feedbackIndicator}
                </div>
            ` : ''}
        </div>
    `;
    
    if (!isUser && !msg.isError && msg.isComplete !== false) {
        const copyBtn = messageDiv.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => copyMessage(msg.content, copyBtn));
        
        const likeBtn = messageDiv.querySelector('.like-btn');
        likeBtn.addEventListener('click', () => handleFeedback(index, 'like'));
        
        const dislikeBtn = messageDiv.querySelector('.dislike-btn');
        dislikeBtn.addEventListener('click', () => handleFeedback(index, 'dislike'));
        
        const regenerateBtn = messageDiv.querySelector('.regenerate-btn');
        regenerateBtn.addEventListener('click', () => regenerateResponse(index));
        const sourcesBtn = messageDiv.querySelector('.sources-btn');
        if (sourcesBtn) sourcesBtn.addEventListener('click', () => openSourcesSheet(msg.sources || [], 0));
        
        messageDiv.querySelectorAll('.source-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const sourceIndex = Number(chip.dataset.sourceIndex || 0);
                openSourcesSheet(msg.sources || [], sourceIndex);
            });
        });
        messageDiv.querySelectorAll('.inline-source-ref').forEach(ref => {
            ref.addEventListener('click', () => {
                const sourceIndex = Math.max(0, Number(ref.dataset.sourceIndex || 1) - 1);
                openSourcesSheet(msg.sources || [], sourceIndex);
            });
        });
    }
    
    return messageDiv;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function parseSimpleMarkdown(text) {
    if (!text) return '';
    let rendered = escapeHtml(text);
    rendered = rendered.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    rendered = rendered.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    rendered = rendered.replace(/\*(.+?)\*/g, '<em>$1</em>');
    rendered = rendered.replace(/__(.+?)__/g, '<strong>$1</strong>');
    rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
    rendered = rendered.replace(/\[(\d+)\]/g, '<button type="button" class="inline-source-ref" data-source-index="$1">[$1]</button>');
    return rendered;
}

function normalizeSources(sources = []) {
    return (Array.isArray(sources) ? sources : [])
        .map((source) => ({
            title: source?.title || source?.name || source?.url || 'Sumber',
            url: source?.url || source?.link || source?.uri || '',
            snippet: source?.snippet || source?.text || source?.description || ''
        }))
        .filter((source) => /^https?:\/\//i.test(source.url));
}

function extractSourcesFromText(text = '') {
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/gi;
    const uniqueMap = new Map();
    let match;
    while ((match = linkPattern.exec(text)) !== null) {
        const title = (match[1] || '').trim();
        const url = (match[2] || match[3] || '').trim();
        if (!/^https?:\/\//i.test(url)) continue;
        if (!uniqueMap.has(url)) {
            uniqueMap.set(url, {
                title: title || new URL(url).hostname.replace(/^www\./, ''),
                url,
                snippet: 'Terdeteksi dari tautan yang ditulis di jawaban AI.'
            });
        }
    }
    return Array.from(uniqueMap.values());
}

function mergeSources(primary = [], fallback = []) {
    const merged = new Map();
    [...normalizeSources(primary), ...normalizeSources(fallback)].forEach((source) => {
        if (!merged.has(source.url)) merged.set(source.url, source);
    });
    return Array.from(merged.values());
}

function getSourceFaviconUrl(url) {
    try {
        const host = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;
    } catch {
        return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    }
}

function renderMessageContent(text) {
    const richText = parseSimpleMarkdown(text);
    return richText;
}

// ========== MESSAGE ACTIONS ==========
async function copyMessage(content, btn) {
    try {
        await navigator.clipboard.writeText(content);
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fas fa-check"></i><span>Tersalin!</span>';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="far fa-copy"></i><span>Salin</span>';
        }, 2000);
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
    
    if (message.feedback === type) {
        message.feedback = null;
    } else {
        message.feedback = type;
    }
    
    saveToStorage();
    renderMessages(conv.messages);
    console.log(`📝 Feedback: ${type} untuk pesan #${messageIndex}`);
}

async function regenerateResponse(messageIndex) {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    
    const message = conv.messages[messageIndex];
    if (!message || message.role !== 'assistant') return;
    
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
    
    conv.messages.splice(messageIndex, 1);
    saveToStorage();
    renderMessages(conv.messages);
    await sendMessage({
        forcedText: userMessage.content || '',
        forcedImageData: userMessage.image || null
    });
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
        'openrouter': '<img src="/login/logo.png" alt="AI"><span>OpenRouter</span>',
        'gpt4o': '<img src="/login/logo.png" alt="AI"><span>ChatGPT 4o</span>',
        'openai': '<img src="/login/logo.png" alt="AI"><span>OpenAI</span>',
        'gemini': '<img src="/login/logo.png" alt="AI"><span>Gemini 2.0 Flash</span>',
        'claude': '<img src="/login/logo.png" alt="AI"><span>Claude Sonnet 4.5</span>'
    };
    if (modelIndicator) {
        modelIndicator.innerHTML = indicators[activeModel] || indicators['gpt4o'];
    }
}

function setActiveModel(model, persist = true) {
    const normalizedModel = ['gpt4o', 'gemini', 'claude'].includes(model) ? model : 'gpt4o';
    activeModel = normalizedModel;
    settingsModelBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.model === activeModel);
    });
    if (modelSelect) modelSelect.value = activeModel;
    if (modelSelectBtnText) modelSelectBtnText.textContent = modelSelect?.selectedOptions?.[0]?.textContent || 'ChatGPT 4o';
    updateModelIndicator();
    if (persist) {
        localStorage.setItem('youz_model', activeModel);
    }
}

settingsModelBtns.forEach(btn => {
    btn.addEventListener('click', () => setActiveModel(btn.dataset.model));
});
modelSelect?.addEventListener('change', (e) => setActiveModel(e.target.value));
modelSelectBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    modelSelectPanel?.classList.toggle('hidden');
});
document.querySelectorAll('.panel-model-item').forEach((btn) => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('locked')) return;
        setActiveModel(btn.dataset.model);
        modelSelectPanel?.classList.add('hidden');
    });
});


function getUserContext() {
    return {
        id: currentUser?.id || '',
        email: currentUser?.email || '',
        name: currentUser?.name || ''
    };
}

function updateQuotaBadge(snapshot = null) {
    if (!quotaBadge) return;
    quotaBadge.classList.add('hidden');
    if (snapshot) quotaState = snapshot;
    const plan = quotaState?.plan || 'free';
    const usage = quotaState?.usage || { chat: 0, image: 0 };
    const limits = quotaState?.limits || (plan === 'premium' ? { chat: 120, image: 15 } : { chat: 20, image: 3 });
    quotaBadge.textContent = `${plan === 'premium' ? 'Premium' : 'Free'} ${usage.chat}/${limits.chat} · Img ${usage.image}/${limits.image}`;
    quotaBadge.classList.toggle('premium', plan === 'premium');
}

async function loadQuotaSnapshot() {
    try {
        const params = new URLSearchParams(getUserContext());
        const res = await fetch(`/api/limits?${params.toString()}`);
        const data = await readApiResponse(res);
        if (data?.success) updateQuotaBadge(data);
    } catch (error) {
        console.warn('Quota snapshot gagal dimuat', error?.message || error);
    }
}

// ========== API CALLS ==========
async function readApiResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return await res.json();
    }

    const rawText = await res.text();
    try {
        return JSON.parse(rawText);
    } catch (error) {
        const fallbackMessage = (rawText || `HTTP ${res.status}`).trim();
        const lowered = fallbackMessage.toLowerCase();
        const isInfraError = lowered.includes('a server error has occurred')
            || lowered.includes('function_invocation_failed')
            || lowered.includes('unexpected token')
            || res.status >= 500;
        if (isInfraError) {
            return {
                success: false,
                content: 'Server sedang bermasalah saat memproses chat. Coba kirim ulang 10–20 detik lagi.',
                status: res.status,
                rawError: fallbackMessage
            };
        }
        return { success: false, content: fallbackMessage, status: res.status };
    }
}

async function callUnifiedAPI(messages, action, imageData, prompt, enableSearch, signal) {
    const modelType = ['gpt4o', 'openai'].includes(activeModel) ? 'openai' : activeModel;
    const res = await fetch('/api/youz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            messages, 
            action,
            enableSearch,
            thinkingMode: thinkingModeEnabled,
            modelType, 
            imageData, 
            prompt,
            userContext: getUserContext()
        }),
        signal 
    });
    return await readApiResponse(res);
}

function shouldGenerateImageFromPrompt(text) {
    const lowered = (text || '').toLowerCase();
    const imageKeywords = ['generate gambar', 'buat gambar', 'bikin gambar', 'gambar ', 'image ', 'create image', 'buatkan ilustrasi', 'ilustrasi','buatkan gambar'];
    return imageKeywords.some(keyword => lowered.includes(keyword));
}

function shouldUseWebSearchFromPrompt(text) {
    const lowered = (text || '').toLowerCase();
    const searchKeywords = [
        'cari', 'search', 'berita', 'terbaru', 'update', 'hari ini',
        'cuaca', 'harga', 'merek', 'rekomendasi', 'news', 'weather',
        'trend', 'tren', 'rilis', 'release', 'review'
    ];
    return searchKeywords.some(keyword => lowered.includes(keyword));
}

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

function showImageDraftFromData(dataURL) {
    currentDraftImage = { dataURL, fileName: 'Gambar', fileSize: '' };
    draftImage.src = dataURL;
    draftFileName.textContent = 'Gambar';
    draftFileSize.textContent = '';
    imageDraftContainer.classList.remove('hidden');
}

// ========== TYPING EFFECT ==========
async function typeWriterEffect(el, text, speed = 20) {
    el.innerHTML = '';
    let i = 0;
    return new Promise(resolve => {
        function type() {
            if (typingAbortRequested) {
                resolve();
                return;
            }
            if (i < text.length) {
                const partial = text.slice(0, i + 1);
                el.innerHTML = renderMessageContent(partial);
                i++;
                if (autoScrollDuringTyping) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                typingTimeout = setTimeout(type, speed);
            } else {
                resolve();
            }
        }
        type();
    });
}

// ========== SEND MESSAGE ==========
async function sendMessage(options = {}) {
    console.log('📤 sendMessage called');
    if (isProcessing && abortController) {
        typingAbortRequested = true;
        clearTimeout(typingTimeout);
        abortController.abort();
        return;
    }
    
    const forcedText = typeof options.forcedText === 'string' ? options.forcedText : null;
    const forcedImageData = options.forcedImageData || null;
    const text = (forcedText ?? messageInput.value).trim();
    console.log('📝 Message:', text);
    
    if ((!text && !currentDraftImage && !forcedImageData) || isProcessing) {
        console.log('❌ Blocked: no text or isProcessing');
        return;
    }
    
    if (!activeConversationId) {
        createNewConversation();
    }
    
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    
    isProcessing = true;
    typingAbortRequested = false;
    abortController = new AbortController();
    setProcessingUI(true);
    searchSuggestions.classList.add('hidden');
    
    const userMessage = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        role: 'user',
        content: text || ((currentDraftImage || forcedImageData) ? '📷 Edit/generate gambar' : '')
    };
    if (forcedImageData) {
        userMessage.image = forcedImageData;
    } else if (currentDraftImage) {
        userMessage.image = currentDraftImage.dataURL;
    }
    
    conv.messages.push(userMessage);
    
    if (conv.messages.filter(m => m.role === 'user').length === 1) {
        conv.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
    }
    
    conv.updatedAt = new Date().toISOString();
    saveToStorage();
    renderMessages(conv.messages);
    renderSidebar();
    
    if (forcedText === null) {
        messageInput.value = '';
        messageInput.style.height = 'auto';
    }
    clearImageDraft();
    
    const loadingId = 'loading-' + Date.now();
    const previewImageGeneration = shouldGenerateImageFromPrompt(text);
    chatMessages.insertAdjacentHTML('beforeend', `
        <div class="message assistant" id="${loadingId}">
            <div class="message-avatar"><img src="/login/logo.png" alt="AI"></div>
            <div class="message-content">
                <div class="thinking-indicator">
                    <div class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></div>
                    <span>${previewImageGeneration ? 'Membuat gambar...' : 'Thinking...'}</span>
                </div>
            </div>
        </div>
    `);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        const messages = conv.messages.map(m => ({ role: m.role, content: m.content }));
        const needSearch = shouldUseWebSearchFromPrompt(text);
        const enableSearch = webSearchEnabled && needSearch;
        const generateImageRequest = (!userMessage.image && shouldGenerateImageFromPrompt(text));
        
        const action = (userMessage.image || generateImageRequest) ? 'generate' : (enableSearch ? 'search' : 'chat');
        const response = await callUnifiedAPI(
            messages,
            action,
            userMessage.image || null,
            text || 'Deskripsikan atau edit gambar ini.',
            enableSearch,
            abortController.signal
        );
        
        document.getElementById(loadingId)?.remove();

        if (response.limit) updateQuotaBadge(response.limit);
        
        const aiMessage = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            role: 'assistant',
            content: '',
            model: response.model || ((generateImageRequest || userMessage.image) ? 'image-generator' : (enableSearch ? 'web-search' : activeModel)),
            isError: !response.success,
            feedback: null,
            sources: mergeSources(response.sources || [], extractSourcesFromText(response.content || '')),
            isComplete: false
        };
        if (response.imageUrl) {
            aiMessage.generatedImage = response.imageUrl;
        }
        
        conv.messages.push(aiMessage);
        conv.updatedAt = new Date().toISOString();
        saveToStorage();
        renderMessages(conv.messages);
        
        const contentEl = document.getElementById(`msg-content-${conv.messages.length - 1}`);
        if (contentEl && response.success) {
            autoScrollDuringTyping = shouldStickToBottom();
            await typeWriterEffect(contentEl, response.content, 20);
            aiMessage.content = contentEl.textContent || response.content;
        } else {
            aiMessage.content = response.content || 'Maaf, tidak ada respons.';
            if (contentEl) contentEl.innerHTML = escapeHtml(aiMessage.content);
        }
        aiMessage.isComplete = true;
        saveToStorage();
        renderMessages(conv.messages);
        
    } catch (error) {
        document.getElementById(loadingId)?.remove();
        if (error.name === 'AbortError') {
            const lastAssistant = conv.messages[conv.messages.length - 1];
            if (lastAssistant?.role === 'assistant' && lastAssistant.isComplete === false) {
                lastAssistant.content = (lastAssistant.content || '').trim();
                lastAssistant.isComplete = true;
            }
            saveToStorage();
            renderMessages(conv.messages);
            return;
        }
        conv.messages.push({
            id: 'msg-' + Date.now(),
            role: 'assistant',
            content: `❌ Error: ${error.message}`,
            isError: true,
            isComplete: true
        });
        saveToStorage();
        renderMessages(conv.messages);
    } finally {
        isProcessing = false;
        abortController = null;
        setProcessingUI(false);
        messageInput.focus();
    }
}

// ========== IMAGE UPLOAD ==========
async function handleImageUpload(file) {
    if (!file) return;
    showImageDraft(file);
}

// ========== LANGUAGE ==========
const translations = {
    id: {
        newChat: 'Percakapan Baru',
        history: 'Riwayat Percakapan',
        settings: 'Pengaturan',
        general: 'Umum',
        profile: 'Profil',
        data: 'Data',
        theme: 'Tema',
        light: 'Terang',
        dark: 'Gelap',
        system: 'Sistem',
        language: 'Bahasa',
        profileInfo: 'Informasi Profil',
        name: 'Nama',
        email: 'Email',
        saveChanges: 'Simpan Perubahan',
        dataManagement: 'Manajemen Data',
        clearAll: 'Hapus Semua Percakapan',
        exportData: 'Ekspor Data',
        messagePlaceholder: 'Send Message YouzAi...',
        sendMessage: 'Kirim Pesan',
        tools: 'Alat',
        getPremium: 'Get Premium',
        about: 'Tentang Youz AI',
        loginPrompt: 'Masuk / Daftar',
        loginNote: 'Login untuk sinkronisasi profil & riwayat.'
    },
    en: {
        newChat: 'New Chat',
        history: 'Chat History',
        settings: 'Settings',
        general: 'General',
        profile: 'Profile',
        data: 'Data',
        theme: 'Theme',
        light: 'Light',
        dark: 'Dark',
        system: 'System',
        language: 'Language',
        profileInfo: 'Profile Information',
        name: 'Name',
        email: 'Email',
        saveChanges: 'Save Changes',
        dataManagement: 'Data Management',
        clearAll: 'Clear All Conversations',
        exportData: 'Export Data',
        messagePlaceholder: 'Send Message YouzAi...',
        sendMessage: 'Send Message',
        tools: 'Tools',
        getPremium: 'Get Premium',
        about: 'About Youz AI',
        loginPrompt: 'Sign in / Register',
        loginNote: 'Sign in to sync profile & history.'
    }
};

function applyLanguage(lang) {
    const t = translations[lang];
    if (!t) return;
    
    if (messageInput) messageInput.placeholder = t.messagePlaceholder;
    
    const settingsTitle = document.getElementById('settingsTitle');
    if (settingsTitle) settingsTitle.textContent = t.settings;
    
    const tabGeneralEl = document.getElementById('tabGeneral');
    if (tabGeneralEl) tabGeneralEl.textContent = t.general;
    
    const tabProfileEl = document.getElementById('tabProfile');
    if (tabProfileEl) tabProfileEl.textContent = t.profile;
    
    const tabDataEl = document.getElementById('tabData');
    if (tabDataEl) tabDataEl.textContent = t.data;
    
    const themeTitle = document.getElementById('themeTitle');
    if (themeTitle) themeTitle.textContent = t.theme;
    
    const lightText = document.getElementById('lightText');
    if (lightText) lightText.textContent = t.light;
    
    const darkText = document.getElementById('darkText');
    if (darkText) darkText.textContent = t.dark;
    
    const systemText = document.getElementById('systemText');
    if (systemText) systemText.textContent = t.system;
    
    const languageTitle = document.getElementById('languageTitle');
    if (languageTitle) languageTitle.textContent = t.language;
    
    const profileInfoTitle = document.getElementById('profileInfoTitle');
    if (profileInfoTitle) profileInfoTitle.textContent = t.profileInfo;
    
    const nameLabel = document.getElementById('nameLabel');
    if (nameLabel) nameLabel.textContent = t.name;
    
    const emailLabel = document.getElementById('emailLabel');
    if (emailLabel) emailLabel.textContent = t.email;
    
    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) saveBtn.textContent = t.saveChanges;
    
    const dataTitle = document.getElementById('dataManagementTitle');
    if (dataTitle) dataTitle.textContent = t.dataManagement;
    
    const clearBtn = document.getElementById('clearAllDataBtn');
    if (clearBtn) clearBtn.innerHTML = `<i class="fas fa-trash-alt"></i> ${t.clearAll}`;
    
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) exportBtn.innerHTML = `<i class="fas fa-download"></i> ${t.exportData}`;

    const newChatLabel = document.querySelector('#newChatBtn');
    if (newChatLabel) newChatLabel.innerHTML = `<i class="fas fa-plus"></i> ${t.newChat}`;

    const historyLabel = document.getElementById('historyLabel');
    if (historyLabel) historyLabel.textContent = t.history;

    const sendBtnText = document.getElementById('sendBtnText');
    if (sendBtnText) sendBtnText.textContent = t.sendMessage;

    if (toolsBtn) toolsBtn.innerHTML = `<i class="fas fa-sliders-h"></i> ${t.tools}`;

    const toolsMenuTitle = document.querySelector('.tools-menu-title');
    if (toolsMenuTitle) toolsMenuTitle.textContent = t.tools;

    if (userPremiumBtn) userPremiumBtn.innerHTML = `<i class="fas fa-crown"></i> ${t.getPremium}`;

    const aboutMenu = document.getElementById('aboutBtn');
    if (aboutMenu) aboutMenu.innerHTML = `<i class="fas fa-info-circle"></i> ${t.about}`;

    const loginBtn = document.querySelector('.sidebar-auth-link.cta');
    if (loginBtn) loginBtn.innerHTML = `<i class="fas fa-right-to-bracket"></i> ${t.loginPrompt}`;

    const loginNote = document.querySelector('.sidebar-auth-note');
    if (loginNote) loginNote.textContent = t.loginNote;
    
    localStorage.setItem('youz_language', lang);
    currentLanguage = lang;
    renderSidebar();
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

newChatBtn?.addEventListener('click', () => {
    createNewConversation();
    switchConversation(activeConversationId);
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
});

headerNewChatBtn?.addEventListener('click', () => {
    createNewConversation();
    switchConversation(activeConversationId);
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
});

sendBtn?.addEventListener('click', sendMessage);
sourcesBackdrop?.addEventListener('click', closeSourcesSheet);

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

toolsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toolsMenu?.classList.toggle('hidden');
});

toolWebSearch?.addEventListener('change', (e) => {
    webSearchEnabled = e.target.checked;
    if (webSearchToggle) webSearchToggle.checked = webSearchEnabled;
    localStorage.setItem('youz_web_search_enabled', webSearchEnabled ? '1' : '0');
});

toolThinking?.addEventListener('change', (e) => {
    thinkingModeEnabled = e.target.checked;
    localStorage.setItem('youz_thinking_enabled', thinkingModeEnabled ? '1' : '0');
});


imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
        imageInput.value = '';
    }
});

removeDraftBtn?.addEventListener('click', clearImageDraft);

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
    alert('Youz AI v2.8\n\nAsisten AI cerdas dengan:\n• ChatGPT (via OpenRouter)\n• Gemini 2.0 Flash\n• Fitur Web Search (sistem)\n• Fitur Generate Image (sistem)\n• Vision Support\n• Image Draft & Typewriter Effect\n• Salin, Like, Dislike, Regenerate\n• Settings & Profile\n\nDibuat oleh Yuzz Ofc.\n\n© 2026 Yuzz Ofc');
    menuDropdown.classList.remove('show');
});

// ========== SETTINGS MODAL EVENTS ==========

settingsCloseBtn?.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

settingsOverlay?.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

tabGeneral?.addEventListener('click', () => {
    tabGeneral.classList.add('active');
    tabProfile.classList.remove('active');
    tabData.classList.remove('active');
    generalContent.classList.remove('hidden');
    profileContent.classList.add('hidden');
    dataContent.classList.add('hidden');
});

tabProfile?.addEventListener('click', () => {
    tabProfile.classList.add('active');
    tabGeneral.classList.remove('active');
    tabData.classList.remove('active');
    profileContent.classList.remove('hidden');
    generalContent.classList.add('hidden');
    dataContent.classList.add('hidden');
});

tabData?.addEventListener('click', () => {
    tabData.classList.add('active');
    tabGeneral.classList.remove('active');
    tabProfile.classList.remove('active');
    dataContent.classList.remove('hidden');
    generalContent.classList.add('hidden');
    profileContent.classList.add('hidden');
});

function setThemePreference(theme, persist = true) {
    const selected = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
    themeLight?.classList.toggle('active', selected === 'light');
    themeDark?.classList.toggle('active', selected === 'dark');
    themeSystem?.classList.toggle('active', selected === 'system');

if (selected === 'system') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', selected);
}

if (persist) {
        localStorage.setItem('youz_theme', selected);
    }
}

themeLight?.addEventListener('click', () => setThemePreference('light'));
themeDark?.addEventListener('click', () => setThemePreference('dark'));
themeSystem?.addEventListener('click', () => setThemePreference('system'));

languageSelect?.addEventListener('change', (e) => {
    applyLanguage(e.target.value);
});

webSearchToggle?.addEventListener('change', (e) => {
    webSearchEnabled = e.target.checked;
    if (toolWebSearch) toolWebSearch.checked = webSearchEnabled;
    localStorage.setItem('youz_web_search_enabled', webSearchEnabled ? '1' : '0');
});


saveProfileBtn?.addEventListener('click', () => {
    if (currentUser) {
        currentUser.name = profileName.value;
        localStorage.setItem('youz_user', JSON.stringify(currentUser));
        updateUserUI();
        alert(currentLanguage === 'id' ? 'Profil berhasil disimpan!' : 'Profile saved successfully!');
    }
});

clearAllDataBtn?.addEventListener('click', () => {
    const confirmMsg = currentLanguage === 'id' ? 
        'Hapus SEMUA percakapan? Tindakan ini tidak dapat dibatalkan.' : 
        'Delete ALL conversations? This action cannot be undone.';
    
    if (confirm(confirmMsg)) {
        conversations = [];
        saveToStorage();
        createNewConversation();
        switchConversation(activeConversationId);
        settingsModal.classList.add('hidden');
    }
});

exportDataBtn?.addEventListener('click', () => {
    const data = {
        conversations: conversations,
        user: currentUser,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youz-ai-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

userProfileBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUser) {
        openSettings('profile');
        toggleUserMenu(false);
    } else {
        alert(currentLanguage === 'id' ? 'Silakan login terlebih dahulu.' : 'Please login first.');
    }
});

userLogoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleUserMenu(false);
    logout();
});

userSettingsBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openSettings('general');
    toggleUserMenu(false);
});

userPremiumBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleUserMenu(false);
    window.location.href = '/beli-premium';
});

userMenuBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleUserMenu();
});

scrollBottomBtn?.addEventListener('click', () => {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
});

chatMessages?.addEventListener('touchstart', () => {
    isTouchingChat = true;
    updateScrollBottomVisibility();
});

chatMessages?.addEventListener('touchend', () => {
    isTouchingChat = false;
    clearTimeout(scrollPauseTimer);
    scrollPauseTimer = setTimeout(updateScrollBottomVisibility, 180);
});

chatMessages?.addEventListener('scroll', () => {
    autoScrollDuringTyping = shouldStickToBottom();
    clearTimeout(scrollPauseTimer);
    scrollPauseTimer = setTimeout(updateScrollBottomVisibility, isTouchingChat ? 220 : 120);
});

document.addEventListener('click', (e) => {
    if (userMenuDropdown && !userMenuDropdown.contains(e.target) && e.target !== userMenuBtn) {
        toggleUserMenu(false);
    }
    if (toolsMenu && toolsBtn && !toolsMenu.contains(e.target) && !toolsBtn.contains(e.target)) {
        toolsMenu.classList.add('hidden');
    }
    if (modelSelectPanel && modelSelectBtn && !modelSelectPanel.contains(e.target) && !modelSelectBtn.contains(e.target)) {
        modelSelectPanel.classList.add('hidden');
    }
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSourcesSheet();
    }
});

// ========== INIT ==========
async function init() {
    checkUserFromURL();
    await syncUserFromServer();
    await loadQuotaSnapshot();
    loadFromStorage();
    webSearchEnabled = localStorage.getItem('youz_web_search_enabled') !== '0';
    thinkingModeEnabled = localStorage.getItem('youz_thinking_enabled') !== '0';
    setActiveModel(localStorage.getItem('youz_model') || 'gpt4o', false);
    if (webSearchToggle) webSearchToggle.checked = webSearchEnabled;
    if (toolWebSearch) toolWebSearch.checked = webSearchEnabled;
    if (toolThinking) toolThinking.checked = thinkingModeEnabled;
    setActiveModel(localStorage.getItem('youz_model') || 'gpt4o', false);
    activeConversationId = conversations[0]?.id;
    renderSidebar();
    if (activeConversationId) {
        switchConversation(activeConversationId);
    } else {
        renderMessages([]);
    }
    updateScrollBottomVisibility();
    setProcessingUI(false);
    if (window.innerWidth <= 768) {
        sidebar.classList.add('closed');
    }
    
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    const savedTheme = localStorage.getItem('youz_theme') || 'system';
    setThemePreference(savedTheme, false);
    
    const savedLang = localStorage.getItem('youz_language') || 'id';
    applyLanguage(savedLang);
    if (languageSelect) languageSelect.value = savedLang;
    
    console.log('✅ Youz AI v2.8 initialized');
}

init();
