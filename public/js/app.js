// ========== STATE ==========
let conversations = [];
let activeConversationId = null;
let activeModel = 'gemini'; // 'gpt4o', 'gemini', 'claude'
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
const MODEL_CATALOG = {
    gemini: {
        label: 'Gemini 2.0 Flash',
        detail: 'Google — Previous gen flash',
        tier: 'standard',
        available: true,
        logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Google-gemini-icon.svg',
        brand: 'Gemini'
    },
    deepseek: {
        label: 'DeepSeek V4 Flash',
        detail: 'DeepSeek — Free via OpenRouter',
        tier: 'standard',
        available: true,
        logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/DeepSeek_logo.svg',
        brand: 'DeepSeek'
    },
    claude: {
        label: 'Claude Sonnet 4.5',
        detail: 'Anthropic — Best all-around',
        tier: 'standard',
        available: true,
        logo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg',
        brand: 'Claude'
    },
    gpt4o: {
        label: 'ChatGPT 4o',
        detail: 'OpenAI — Premium Model due to limited Credit',
        tier: 'premium',
        available: true,
        requiresPremium: true,
        logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg',
        brand: 'OpenAI'
    }
};

function protectLogos() {
    document.querySelectorAll('img.secure-logo, img.brand-mark').forEach((img) => {
        img.setAttribute('draggable', 'false');
        img.setAttribute('loading', img.getAttribute('loading') || 'lazy');
        img.addEventListener('dragstart', (e) => e.preventDefault());
        img.addEventListener('contextmenu', (e) => e.preventDefault());
        img.addEventListener('mousedown', (e) => {
            if (e.button === 1) e.preventDefault();
        });
    });
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const blocked = ['s', 'u', 'p'];
        if (blocked.includes(String(e.key || '').toLowerCase())) e.preventDefault();
    });
}

// DOM Elements
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
const sidebarToggleIconSidebar = document.getElementById('sidebarToggleIconSidebar');
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
const composerMenu = document.getElementById('composerMenu');
const composerMenuBackdrop = document.getElementById('composerMenuBackdrop');
const composerMenuPhoto = document.getElementById('composerMenuPhoto');
const modelMenuStandardList = document.getElementById('modelMenuStandardList');
const modelMenuPremiumList = document.getElementById('modelMenuPremiumList');
const toolWebSearch = document.getElementById('toolWebSearch');
const toolThinking = document.getElementById('toolThinking');
const imageInput = document.getElementById('imageInput');
const newChatBtn = document.getElementById('newChatBtn');
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const userMenuBtn = document.getElementById('userMenuBtn');
const userMenuDropdown = document.getElementById('userMenuDropdown');
const userSettingsBtn = document.getElementById('userSettingsBtn');
const userProfileBtn = document.getElementById('userProfileBtn');
const userPremiumBtn = document.getElementById('userPremiumBtn');
const settingsNotifBadge = document.getElementById('settingsNotifBadge');
const userLogoutBtn = document.getElementById('userLogoutBtn');
const currentTimeSpan = document.getElementById('currentTime');
const searchSuggestions = document.getElementById('searchSuggestions');
const modelIndicator = document.getElementById('modelIndicator');
const quotaBadge = document.getElementById('quotaBadge');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
const limitNotice = document.getElementById('limitNotice');
const limitNoticeText = document.getElementById('limitNoticeText');
const limitNoticeCta = document.getElementById('limitNoticeCta');
const limitNoticeClose = document.getElementById('limitNoticeClose');
const modelPanelNote = document.getElementById('modelPanelNote');
const premiumUpgradeBadge = document.getElementById('premiumUpgradeBadge');
const profilePlanBadge = document.getElementById('profilePlanBadge');
// ========== FITUR BARU: DOM ELEMENTS TAMBAHAN ==========
const imageDraftContainer = document.getElementById('imageDraftContainer');
const draftImage = document.getElementById('draftImage');
const draftFileName = document.getElementById('draftFileName');
const draftFileSize = document.getElementById('draftFileSize');
const removeDraftBtn = document.getElementById('removeDraftBtn');
const sourcesSheet = document.getElementById('sourcesSheet');
const sourcesBackdrop = document.getElementById('sourcesBackdrop');
const sourcesList = document.getElementById('sourcesList');
const sourcesCloseBtn = document.getElementById('sourcesCloseBtn');
const sourcesHeaderLogos = document.getElementById('sourcesHeaderLogos');
const sourcesHeaderQuery = document.getElementById('sourcesHeaderQuery');
const confirmModal = document.getElementById('confirmModal');
const confirmBackdrop = document.getElementById('confirmBackdrop');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const toastContainer = document.getElementById('toastContainer');

function isMobileViewport() {
    return window.innerWidth <= 768;
}

function toggleSidebarVisibility() {
    if (!sidebar) return;
    if (isMobileViewport()) {
        sidebar.classList.toggle('closed');
    } else {
        const nextCollapsed = !sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed', nextCollapsed);
        localStorage.setItem('youz_sidebar_collapsed', nextCollapsed ? '1' : '0');
    }
    syncSidebarToggleUI();
}

function closeSidebarVisibility() {
    if (!sidebar) return;
    if (isMobileViewport()) {
        sidebar.classList.add('closed');
    } else {
        sidebar.classList.add('collapsed');
        localStorage.setItem('youz_sidebar_collapsed', '1');
    }
    syncSidebarToggleUI();
}

function syncSidebarToggleUI() {
    if (!sidebar) return;
    const isMobile = isMobileViewport();
    const isHidden = isMobile ? sidebar.classList.contains('closed') : sidebar.classList.contains('collapsed');
    const iconClass = isHidden ? 'fas fa-bars' : 'fas fa-times';
    if (sidebarToggleIcon) sidebarToggleIcon.className = iconClass;
    if (sidebarToggleIconSidebar) sidebarToggleIconSidebar.className = iconClass;
    hamburgerBtn?.setAttribute('aria-label', isHidden ? 'Buka sidebar' : 'Tutup sidebar');
    closeSidebarBtn?.setAttribute('aria-label', isHidden ? 'Buka sidebar' : 'Tutup sidebar');
    sidebarBackdrop?.classList.toggle('open', isMobile && !isHidden);
}

function applySidebarViewportDefaults() {
    if (!sidebar) return;
    const isMobile = isMobileViewport();
    if (isMobile) {
        sidebar.classList.add('closed');
        sidebar.classList.remove('collapsed');
    } else {
        sidebar.classList.remove('closed');
        const saved = localStorage.getItem('youz_sidebar_collapsed');
        sidebar.classList.toggle('collapsed', saved === '1');
    }
    syncSidebarToggleUI();
}
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
const draftImageLoading = document.getElementById('draftImageLoading');
const imagePreviewModal = document.getElementById('imagePreviewModal');
const imagePreviewBackdrop = document.getElementById('imagePreviewBackdrop');
const imagePreviewFull = document.getElementById('imagePreviewFull');
const downloadPreviewBtn = document.getElementById('downloadPreviewBtn');
const closeImagePreviewBtn = document.getElementById('closeImagePreviewBtn');
const sidebarAuthLinks = document.getElementById('sidebarAuthLinks');
const sidebarAuthRequiredLinks = document.querySelectorAll('.sidebar-link.requires-auth');

// Language state
let currentLanguage = localStorage.getItem('youz_language') || 'id';
let isTouchingChat = false;
let scrollPauseTimer = null;

function createNanoId(size = 12) {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const cryptoObj = window.crypto || window.msCrypto;
    let id = '';
    if (cryptoObj?.getRandomValues) {
        const bytes = new Uint8Array(size);
        cryptoObj.getRandomValues(bytes);
        for (let i = 0; i < size; i++) id += alphabet[bytes[i] % alphabet.length];
        return id;
    }
    for (let i = 0; i < size; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
    return id;
}

function showToast(message, type = 'info', duration = 2200) {
    if (!toastContainer) return;
    const text = String(message || '').trim();
    if (!text) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = type === 'success' ? '✓' : (type === 'error' ? '!' : 'i');
    const label = document.createElement('div');
    label.className = 'toast-text';
    label.textContent = text;
    toast.appendChild(icon);
    toast.appendChild(label);
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    window.setTimeout(() => {
        toast.classList.remove('show');
        window.setTimeout(() => toast.remove(), 220);
    }, Math.max(800, Number(duration) || 2200));
}

let confirmResolve = null;
function openConfirmDialog({ title = 'Konfirmasi', message = '', okText = 'OK', cancelText = 'Batal', showCancel = true } = {}) {
    return new Promise((resolve) => {
        if (!confirmModal || !confirmOkBtn || !confirmCancelBtn || !confirmTitle || !confirmMessage) return resolve(false);
        confirmResolve = resolve;
        confirmTitle.textContent = String(title || 'Konfirmasi');
        confirmMessage.textContent = String(message || '');
        confirmOkBtn.textContent = String(okText || 'OK');
        confirmCancelBtn.textContent = String(cancelText || 'Batal');
        confirmCancelBtn.classList.toggle('hidden', !showCancel);
        confirmModal.classList.remove('hidden');
        confirmOkBtn.focus();
    });
}

function closeConfirmDialog(result = false) {
    if (!confirmModal) return;
    confirmModal.classList.add('hidden');
    const resolve = confirmResolve;
    confirmResolve = null;
    if (typeof resolve === 'function') resolve(Boolean(result));
}

function updateChatRoute(id = null, replace = false) {
    const target = id ? `/c/${encodeURIComponent(id)}` : '/c/new';
    if (window.location.pathname === target) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', target);
}

// ========== LOCALSTORAGE DATABASE ==========
function loadFromStorage() {
    const saved = localStorage.getItem(getConversationStorageKey());
    if (saved) {
        try {
            conversations = JSON.parse(saved);
            if (Array.isArray(conversations)) {
                conversations = conversations.map((conv) => ({ ...conv, serverId: conv?.serverId || null }));
            }
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
    queueConversationBackup();
}

function getConversationStorageKey() {
    const userKey = currentUser?.email || currentUser?.id || 'guest';
    return `youz_ai_conversations_${String(userKey).toLowerCase()}`;
}

function formatHeaderConversationTitle(rawTitle = '') {
    const text = String(rawTitle || '').trim() || 'Percakapan Baru';
    const maxLength = 34;
    return text.length > maxLength ? `${text.slice(0, maxLength)}.....` : text;
}

function createNewConversation() {
    const newConv = {
        id: createNanoId(16),
        serverId: null,
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


async function refreshSettingsNotificationBadge() {
    if (!settingsNotifBadge) return;
    try {
        const res = await fetch('/api/settings?scope=notifications');
        const data = await readApiResponse(res);
        const count = Number(data?.unread_count || 0);
        settingsNotifBadge.textContent = String(count);
        settingsNotifBadge.classList.toggle('hidden', count <= 0);
    } catch {
        settingsNotifBadge.classList.add('hidden');
    }
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

async function syncHistoryFromServerIfEmpty() {
    if (!currentUser) return;
    const userId = currentUser?.id || currentUser?.sub || currentUser?.user_id || currentUser?._id || '';
    const email = currentUser?.email || '';
    if (!userId && !email) return;
    const hasLocalMessages = Array.isArray(conversations) && conversations.some((c) => (c?.messages || []).length > 0);
    if (hasLocalMessages) return;
    try {
        const qs = new URLSearchParams({ mode: 'history', userId: String(userId || ''), email: String(email || '') });
        const res = await fetch(`/api/youz?${qs.toString()}`);
        const data = await readApiResponse(res);
        const history = data?.history;
        const serverConversation = history?.conversation;
        const serverMessages = history?.messages;
        if (!serverConversation || !Array.isArray(serverMessages) || serverMessages.length === 0) return;
        const mappedMessages = serverMessages.map((msg) => ({
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            role: msg.role,
            content: msg.content || '',
            isComplete: true
        }));
        const newConv = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            serverId: serverConversation.id || null,
            title: serverConversation.title || 'Riwayat',
            messages: mappedMessages,
            createdAt: serverConversation.created_at || new Date().toISOString(),
            updatedAt: serverConversation.updated_at || new Date().toISOString()
        };
        conversations = [newConv];
        activeConversationId = newConv.id;
        saveToStorage();
    } catch {}
}

function restoreConversationBackup(settings = null) {
    if (!settings || !Array.isArray(settings.conversation_backup) || settings.conversation_backup.length === 0) return false;
    const hasLocalMessages = Array.isArray(conversations) && conversations.some((c) => (c?.messages || []).length > 0);
    if (hasLocalMessages) return false;
    conversations = settings.conversation_backup.map((conv) => ({
        id: conv.id || createNanoId(16),
        serverId: conv.serverId || null,
        title: conv.title || 'Percakapan',
        createdAt: conv.createdAt || new Date().toISOString(),
        updatedAt: conv.updatedAt || new Date().toISOString(),
        messages: Array.isArray(conv.messages) ? conv.messages : []
    }));
    activeConversationId = conversations[0]?.id || null;
    saveToStorage();
    return true;
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
        const detectedPlan = String(currentUser.plan || currentUser.plan_name || '').toLowerCase();
        if (detectedPlan === 'premium' || detectedPlan.startsWith('premium_') || detectedPlan.startsWith('premium-')) {
            updateQuotaBadge({
                plan: 'premium',
                usage: quotaState?.usage || { chat: 0, image: 0 },
                limits: quotaState?.limits || { chat: 120, image: 15 },
                usageDate: quotaState?.usageDate || new Date().toISOString().slice(0, 10)
            });
        }
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


function updateSendButtonState() {
    if (!sendBtn || isProcessing) return;
    const hasText = (messageInput?.value || '').trim() !== '';
    const hasImage = Boolean(currentDraftImage);
    const enabled = hasText || hasImage;
    sendBtn.disabled = !enabled;
    sendBtn.classList.toggle('disabled', !enabled);
}

function hardResetProcessingState() {
    isProcessing = false;
    typingAbortRequested = false;
    typingTimeout = null;
    abortController = null;
    document.querySelectorAll('.message.assistant.pending').forEach((el) => el.remove());
    setProcessingUI(false);
    updateSendButtonState();
}

function toggleComposerMenu(forceShow = null) {
    if (!composerMenu || !composerMenuBackdrop || !attachBtn) return;
    const nextShow = forceShow === null ? composerMenu.classList.contains('hidden') : forceShow;
    composerMenu.classList.toggle('hidden', !nextShow);
    composerMenuBackdrop.classList.toggle('hidden', !nextShow);
    attachBtn.classList.toggle('is-open', nextShow);
}

function openSourcesSheet(sources = [], focusIndex = 0, queryTitle = '') {
    if (!sourcesList || !sourcesSheet) return;
    const normalized = normalizeSources(sources);
    activeSources = normalized;
    if (sourcesHeaderQuery) sourcesHeaderQuery.textContent = String(queryTitle || '').trim();
    if (sourcesHeaderLogos) {
        sourcesHeaderLogos.innerHTML = normalized.slice(0, 3).map((source) => `<img src="${getSourceFaviconUrl(source.url)}" alt="" loading="lazy">`).join('');
    }
    sourcesList.innerHTML = !normalized.length
        ? '<p>Tidak ada sumber.</p>'
        : normalized.map((source, index) => {
            const favicon = getSourceFaviconUrl(source.url);
            const domain = source.domain || (() => { try { return new URL(source.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
            const subtitle = String(source.snippet || domain || '').trim();
            return `
                <div class="source-item">
                    <a href="${source.url}" target="_blank" rel="noopener noreferrer">
                        <img src="${favicon}" alt="" loading="lazy">
                        <span>[${index + 1}] ${escapeHtml(source.title || domain || source.url)}</span>
                    </a>
                    ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
                </div>
            `;
        }).join('');
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
    
    closeSidebarVisibility();
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

function closeSettings() {
    settingsModal.classList.add('hidden');
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
        chatTitle.textContent = formatHeaderConversationTitle(conv.title || 'Percakapan Baru');
        chatTitle.title = conv.title || 'Percakapan Baru';
        renderMessages(conv.messages);
        renderSidebar();
        saveToStorage();
        updateChatRoute(conv.messages?.length ? conv.id : null);
    }
    if (isMobileViewport()) {
        closeSidebarVisibility();
    }
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <img src="/asset/logo.jpg" alt="Youz AI Logo" class="secure-logo" draggable="false" oncontextmenu="return false;">
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
    const isImageOnly = Boolean(msg.generatedImage) && !String(msg.content || '').trim();
    messageDiv.className = `message ${msg.role} ${msg.isError ? 'error' : ''} ${msg.isComplete === false ? 'pending' : ''} ${isImageOnly ? 'image-only' : ''}`;
    messageDiv.dataset.messageIndex = index;
    messageDiv.dataset.messageId = msg.id || `msg-${Date.now()}-${index}`;
    
    let content = renderMessageContent(msg.content);
    if (msg.image) {
        content += `<div class="message-image"><img src="${msg.image}" alt="Uploaded"></div>`;
    }
    if (msg.generatedImage) {
        const imageData = encodeURIComponent(msg.generatedImage);
        content = `${String(msg.content || '').trim() ? `${content}` : ''}<div class="message-image generated-image"><button class="generated-image-btn" type="button" data-image="${imageData}" aria-label="Preview gambar"><img src="${msg.generatedImage}" alt="Generated"></button></div>`;
    }
    
    let feedbackIndicator = '';
    if (msg.feedback === 'like') {
        feedbackIndicator = '<span class="feedback-indicator"><i class="fas fa-thumbs-up"></i> Disukai</span>';
    } else if (msg.feedback === 'dislike') {
        feedbackIndicator = '<span class="feedback-indicator"><i class="fas fa-thumbs-down"></i> Tidak disukai</span>';
    }
    
    const shouldShowThinkingMeta = thinkingModeEnabled;
    const showMeta = !isUser && shouldShowThinkingMeta && (msg.isComplete === false || typeof msg.thinkingMs === 'number');
    const metaText = !isUser && shouldShowThinkingMeta
        ? (msg.isComplete === false
            ? 'AI sedang berpikir'
            : (typeof msg.thinkingMs === 'number' ? `Selesai berpikir selama ${formatThinkingDuration(msg.thinkingMs)}` : ''))
        : '';
    const metaHtml = showMeta && metaText
        ? `<div class="message-meta"><span>${escapeHtml(metaText)}</span><span class="message-meta-chevron">›</span></div>`
        : '';
    const sourcesButtonLabel = !isUser && !msg.isError && shouldShowSourcesButton(msg)
        ? String(msg.searchTitle || msg.searchQuery || msg.queryTitle || '').trim() || 'Sumber'
        : '';

    const showActions = !isUser && !msg.isError && !isImageOnly;
    messageDiv.innerHTML = `
        <div class="message-content-wrapper">
            ${metaHtml}
            <div class="message-content" id="msg-content-${index}">
                ${content}
            </div>
            ${showActions ? `
                <div class="message-actions">
                    <div class="message-actions-left">
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
                        ${sourcesButtonLabel ? `
                        <button class="action-btn sources-btn has-sources" type="button" title="Sumber" data-index="${index}">
                            <span class="source-logo-stack">${(msg.sources || []).slice(0,3).map(source => `<img src="${getSourceFaviconUrl(source.url)}" alt="" loading="lazy">`).join('')}</span>
                            <span>${escapeHtml(sourcesButtonLabel)}</span>
                        </button>
                        ` : ''}
                    </div>
                    <div class="message-actions-right">
                        ${feedbackIndicator}
                    </div>
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
        if (sourcesBtn) sourcesBtn.addEventListener('click', () => openSourcesSheet(msg.sources || [], 0, msg.searchTitle || ''));
        const previewGeneratedBtn = messageDiv.querySelector('.preview-generated-btn');
        if (previewGeneratedBtn) {
            previewGeneratedBtn.addEventListener('click', () => {
                const imageUrl = decodeURIComponent(previewGeneratedBtn.dataset.image || '');
                if (!imageUrl) return;
                openGeneratedImagePreview(imageUrl);
            });
        }
        
        messageDiv.querySelectorAll('.source-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const sourceIndex = Number(chip.dataset.sourceIndex || 0);
                openSourcesSheet(msg.sources || [], sourceIndex, msg.searchTitle || '');
            });
        });
        messageDiv.querySelectorAll('.inline-source-ref').forEach(ref => {
            ref.addEventListener('click', () => {
                const sourceIndex = Math.max(0, Number(ref.dataset.sourceIndex || 1) - 1);
                openSourcesSheet(msg.sources || [], sourceIndex, msg.searchTitle || '');
            });
        });
    }
    

    messageDiv.querySelectorAll('.code-copy-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const raw = decodeURIComponent(btn.dataset.code || '');
            try {
                await navigator.clipboard.writeText(raw);
                const original = btn.textContent;
                btn.textContent = 'Copied';
                setTimeout(() => btn.textContent = original, 1200);
            } catch {}
        });
    });

    const generatedImageBtn = messageDiv.querySelector('.generated-image-btn');
    if (generatedImageBtn) {
        generatedImageBtn.addEventListener('click', () => {
            const imageUrl = decodeURIComponent(generatedImageBtn.dataset.image || '');
            if (!imageUrl) return;
            openGeneratedImagePreview(imageUrl);
        });
    }

    applyCodeHighlighting(messageDiv);
    return messageDiv;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function decodeHtmlEntities(text) {
    if (!text || typeof text !== 'string') return '';
    if (!/[&][a-z#0-9]+;/i.test(text)) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

function normalizeResponseText(text) {
    const raw = decodeHtmlEntities(String(text || ''));
    if (!raw.includes('\\n') && /\\\\n/.test(raw)) {
        return raw.replace(/\\\\n/g, '\\n');
    }
    return raw;
}

function parseSimpleMarkdown(text) {
    if (!text) return '';
    let rendered = escapeHtml(text);
    rendered = rendered.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang = '', code = '') => {
        const language = String(lang || 'text').trim().toLowerCase();
        const codeText = code.replace(/^\n+|\n+$/g, '');
        const encodedCode = encodeURIComponent(codeText);
        return `<div class="code-block"><div class="code-header"><span class="code-language">${escapeHtml(language)}</span><button type="button" class="code-copy-btn" data-code="${encodedCode}" aria-label="Salin kode">Copy</button></div><pre><code class="language-${escapeHtml(language)}">${escapeHtml(codeText)}</code></pre></div>`;
    });
    rendered = rendered.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    rendered = rendered.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    rendered = rendered.replace(/\*(.+?)\*/g, '<em>$1</em>');
    rendered = rendered.replace(/__(.+?)__/g, '<strong>$1</strong>');
    rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
    rendered = rendered.replace(/\[(\d+)\]/g, '<button type="button" class="inline-source-ref" data-source-index="$1">[$1]</button>');
    rendered = rendered.replace(/\n/g, '<br>');
    return rendered;
}

function buildTypingPreviewMarkdown(text = '') {
    let preview = String(text || '');
    const fenceCount = (preview.match(/```/g) || []).length;
    if (fenceCount % 2 === 1) preview += '\n```';
    const backticks = (preview.match(/`/g) || []).length;
    if (backticks % 2 === 1) preview += '`';
    return preview;
}

function normalizeSources(sources = []) {
    return (Array.isArray(sources) ? sources : [])
        .map((source) => {
            const url = source?.url || source?.link || source?.uri || '';
            let domain = source?.domain || '';
            if (!domain && /^https?:\/\//i.test(url)) {
                try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
            }
            return {
                id: source?.id,
                title: source?.title || source?.name || source?.url || 'Sumber',
                url,
                domain,
                snippet: source?.snippet || source?.text || source?.description || ''
            };
        })
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


function shouldShowSourcesButton(msg) {
    const hasSearchResult = Boolean(msg?.hasSearch) || (msg?.model === 'web-search');
    const hasSources = Array.isArray(msg?.sources) && msg.sources.length > 0;
    const isImageResponse = Boolean(msg?.generatedImage);
    return hasSearchResult && hasSources && !isImageResponse;
}

function formatThinkingDuration(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value < 0) return '';
    if (value < 1000) return 'sepersekian detik';
    if (value < 60_000) return `${Math.round(value / 100) / 10} detik`;
    const minutes = Math.floor(value / 60_000);
    const seconds = Math.round((value - minutes * 60_000) / 1000);
    if (minutes <= 0) return `${seconds} detik`;
    if (seconds <= 0) return `${minutes} menit`;
    return `${minutes} menit ${seconds} detik`;
}

function getSourcesSummaryText(sources = []) {
    const normalized = normalizeSources(sources);
    if (!normalized.length) return '';
    const first = normalized[0];
    const label = first?.domain || (() => {
        try { return new URL(first.url).hostname.replace(/^www\./, ''); } catch { return 'Sumber'; }
    })();
    return normalized.length > 1 ? `${label} +${normalized.length - 1}` : label;
}

function renderPlainTextContent(text) {
    const safe = escapeHtml(text || '');
    return safe.replace(/<br>/g, '<br><span class="typing-cursor">▌</span>').replace(/<span class="typing-cursor">▌<\/span>$/, '') + '<span class="typing-cursor">▌</span>';
}

function applyCodeHighlighting(scope = document) {
    if (!window.hljs || !scope) return;
    scope.querySelectorAll('pre code').forEach((block) => {
        if (block.dataset.highlighted === 'true') return;
        window.hljs.highlightElement(block);
        block.dataset.highlighted = 'true';
    });
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
        showToast('Tersalin', 'success');
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="far fa-copy"></i><span>Salin</span>';
        }, 2000);
        console.log('✅ Pesan disalin');
    } catch (err) {
        console.error('Gagal menyalin:', err);
        showToast('Gagal menyalin pesan', 'error');
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
    showToast(type === 'like' ? 'Disukai' : 'Tidak disukai', 'success');
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
        showToast('Tidak dapat menemukan pertanyaan untuk direspon ulang.', 'error');
        return;
    }
    
    conv.messages.splice(messageIndex, 1);
    saveToStorage();
    renderMessages(conv.messages);
    showToast('Regenerate...', 'info', 1200);
    await sendMessage({
        forcedText: userMessage.content || '',
        forcedImageData: userMessage.image || null
    });
}

// ========== ACTIONS ==========
function deleteConversation(id) {
    openConfirmDialog({
        title: 'Hapus percakapan?',
        message: 'Percakapan ini akan dihapus permanen.',
        okText: 'Hapus',
        cancelText: 'Batal'
    }).then((ok) => {
        if (!ok) return;
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
        showToast('Percakapan dihapus', 'success');
    });
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
        'openrouter': '<i class="fas fa-robot"></i> <span>OpenRouter</span>',
        'gpt4o': '<img src="https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg" alt="OpenAI"><span>ChatGPT</span>',
        'openai': '<img src="https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg" alt="OpenAI"><span>OpenAI</span>',
        'gemini': '<img src="https://upload.wikimedia.org/wikipedia/commons/8/8f/Google-gemini-icon.svg" alt="Gemini"><span>Gemini</span>',
        'claude': '<i class="fas fa-feather-pointed"></i><span>Claude</span>',
        'deepseek': '<i class="fas fa-bolt"></i><span>DeepSeek</span>'
    };
    if (modelIndicator) {
        modelIndicator.innerHTML = indicators[activeModel] || indicators['gpt4o'];
    }
}

function renderModelMenu() {
    if (!modelMenuStandardList || !modelMenuPremiumList) return;
    const isPremium = String(quotaState?.plan || 'free').toLowerCase() === 'premium';
    const order = ['gemini', 'deepseek', 'claude', 'gpt4o'];
    modelMenuStandardList.innerHTML = '';
    modelMenuPremiumList.innerHTML = '';
    order.forEach((key) => {
        const spec = MODEL_CATALOG[key];
        if (!spec) return;
        const locked = Boolean(spec.requiresPremium) && !isPremium;
        const disabled = !spec.available || locked;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `composer-menu-model-item${key === activeModel ? ' active' : ''}${disabled ? ' disabled' : ''}`;
        btn.dataset.model = key;
        const badge = spec.badge
            ? `<span class="composer-menu-badge">${escapeHtml(spec.badge)}</span>`
            : (locked ? '<i class="fas fa-lock"></i>' : '');
        const logo = spec.logo
            ? `<img class="model-brand-logo brand-mark" src="${escapeHtml(spec.logo)}" alt="${escapeHtml(spec.brand || spec.label)}" loading="lazy" draggable="false">`
            : '<i class="fas fa-robot model-brand-fallback" aria-hidden="true"></i>';
        btn.innerHTML = `<span class="composer-model-main">${logo}<span>${escapeHtml(spec.label)}<small>${escapeHtml(spec.detail)}</small></span></span>${badge}`;
        btn.addEventListener('click', () => {
            if (disabled) {
                        if (!spec.available) showToast('Claude Sonnet sedang maintenance.', 'info');
                return;
            }
            setActiveModel(key);
            toggleComposerMenu(false);
        });
        if (spec.tier === 'premium') modelMenuPremiumList.appendChild(btn);
        else modelMenuStandardList.appendChild(btn);
    });
    if (modelPanelNote) {
        const note = isPremium
            ? 'Premium models unlocked.'
            : 'Upgrade untuk akses premium models.';
        modelPanelNote.textContent = note;
    }
}

function setActiveModel(model, persist = true) {
    const normalizedModel = MODEL_CATALOG[model] ? model : 'gemini';
    const isPremium = String(quotaState?.plan || 'free').toLowerCase() === 'premium';
    if (!MODEL_CATALOG[normalizedModel]?.available) {
        showToast('Claude Sonnet sedang maintenance.', 'info');
        return;
    }
    if (normalizedModel === 'gpt4o' && !isPremium) {
        showLimitNotice({ limit: { usageDate: quotaState?.usageDate || new Date().toISOString().slice(0, 10) } });
        return;
    }
    activeModel = normalizedModel;
    settingsModelBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.model === activeModel);
    });
    updateModelIndicator();
    renderModelMenu();
    if (persist) {
        localStorage.setItem('youz_model', activeModel);
        queueUserSettingsSave({ model: activeModel });
        // no toast saat pengalihan model
    }
}

settingsModelBtns.forEach(btn => {
    btn.addEventListener('click', () => setActiveModel(btn.dataset.model));
});


function getUserContext() {
    return {
        id: currentUser?.id || currentUser?.sub || currentUser?.user_id || currentUser?._id || '',
        email: currentUser?.email || '',
        name: currentUser?.name || currentUser?.fullName || currentUser?.username || ''
    };
}

function updateQuotaBadge(snapshot = null) {
    if (snapshot) quotaState = snapshot;
    const plan = String(quotaState?.plan || 'free').toLowerCase();
    const isPremium = plan === 'premium';
    premiumUpgradeBadge?.classList.toggle('hidden', isPremium);
    if (profilePlanBadge) {
        profilePlanBadge.textContent = isPremium ? 'Premium' : 'Free';
        profilePlanBadge.classList.toggle('is-free', !isPremium);
        profilePlanBadge.classList.toggle('premium', isPremium);
    }
    if (isPremium && !['gpt4o', 'claude', 'gemini', 'deepseek'].includes(activeModel)) {
        setActiveModel('gpt4o');
    }
    renderModelMenu();
    const usage = quotaState?.usage || { chat: 0, image: 0 };
    const limits = quotaState?.limits || (plan === 'premium' ? { chat: 120, image: 15 } : { chat: 20, image: 3 });
    if (quotaBadge) {
        quotaBadge.textContent = `${plan === 'premium' ? 'Premium' : 'Free'} ${usage.chat}/${limits.chat} · Img ${usage.image}/${limits.image}`;
        quotaBadge.classList.toggle('premium', plan === 'premium');
        quotaBadge.classList.remove('hidden');
    }
}


function showLimitNotice(data) {
    if (!limitNotice || !limitNoticeText) return;
    const reset = data?.limit?.usageDate || new Date().toISOString().slice(0,10);
    limitNoticeText.textContent = `Anda telah mencapai batas. Upgrade ke YouzAi Premium atau coba lagi setelah reset limit (${reset}).`;
    limitNotice.classList.remove('hidden');
    limitNoticeCta?.classList.remove('hidden');
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

let pendingSettingsPatch = {};
let settingsSaveTimer = null;
let conversationBackupTimer = null;

async function fetchUserSettings() {
    if (!currentUser) return null;
    try {
        const params = new URLSearchParams(getUserContext());
        const res = await fetch(`/api/settings?${params.toString()}`);
        const data = await readApiResponse(res);
        if (data?.success) return data.settings || null;
    } catch {}
    return null;
}

function applyUserSettingsSnapshot(settings) {
    const snapshot = settings || {};
    if (snapshot.theme) {
        setThemePreference(snapshot.theme, false);
        localStorage.setItem('youz_theme', snapshot.theme);
    }
    if (snapshot.language) {
        applyLanguage(snapshot.language, false);
        localStorage.setItem('youz_language', snapshot.language);
        if (languageSelect) languageSelect.value = snapshot.language;
    }
    if (snapshot.model) {
        setActiveModel(snapshot.model, false);
        localStorage.setItem('youz_model', snapshot.model);
    }
    if (typeof snapshot.web_search_enabled === 'boolean') {
        webSearchEnabled = snapshot.web_search_enabled;
        if (toolWebSearch) toolWebSearch.checked = webSearchEnabled;
        localStorage.setItem('youz_web_search_enabled', webSearchEnabled ? '1' : '0');
    }
    if (typeof snapshot.thinking_enabled === 'boolean') {
        thinkingModeEnabled = snapshot.thinking_enabled;
        if (toolThinking) toolThinking.checked = thinkingModeEnabled;
        localStorage.setItem('youz_thinking_enabled', thinkingModeEnabled ? '1' : '0');
    }
}

function queueUserSettingsSave(patch = {}) {
    if (!currentUser) return;
    pendingSettingsPatch = { ...pendingSettingsPatch, ...patch };
    if (settingsSaveTimer) window.clearTimeout(settingsSaveTimer);
    settingsSaveTimer = window.setTimeout(async () => {
        const payload = pendingSettingsPatch;
        pendingSettingsPatch = {};
        settingsSaveTimer = null;
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, userContext: getUserContext() })
            });
        } catch {}
    }, 400);
}

function buildConversationBackupPayload() {
    return (conversations || []).slice(0, 12).map((conv) => ({
        id: conv.id,
        serverId: conv.serverId || null,
        title: conv.title || 'Percakapan',
        createdAt: conv.createdAt || new Date().toISOString(),
        updatedAt: conv.updatedAt || new Date().toISOString(),
        messages: (conv.messages || []).slice(-40).map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: String(msg.content || ''),
            isComplete: msg.isComplete !== false
        }))
    }));
}

function queueConversationBackup() {
    if (!currentUser) return;
    if (conversationBackupTimer) window.clearTimeout(conversationBackupTimer);
    conversationBackupTimer = window.setTimeout(async () => {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation_backup: buildConversationBackupPayload(), userContext: getUserContext() })
            });
        } catch {}
    }, 800);
}

async function callUnifiedAPI(messages, action, imageData, prompt, enableSearch, conversationId, signal) {
    const modelType = activeModel;
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
            userContext: getUserContext(),
            conversationId
        }),
        signal 
    });
    return await readApiResponse(res);
}

function shouldUseWebSearchFromPrompt(text) {
    if (!webSearchEnabled) return false;
    return String(text || '').trim().length > 0;
}

function shouldGenerateImageFromPrompt(text) {
    const raw = String(text || '').toLowerCase();
    if (!raw.trim()) return false;
    return /(generate|buatkan|buat|gambar|ilustrasi|poster|logo|image)/.test(raw)
        && /(generate|buat|gambar|image)/.test(raw);
}

// ========== IMAGE DRAFT ==========
function showImageDraft(file) {
    draftImageLoading?.classList.remove('hidden');
    draftImage?.parentElement?.classList.add('is-loading');
    const reader = new FileReader();
    reader.onload = (e) => {
        currentDraftImage = { file, dataURL: e.target.result, fileName: file.name, fileSize: formatFileSize(file.size) };
        draftImage.src = e.target.result;
        draftFileName.textContent = file.name;
        draftFileSize.textContent = formatFileSize(file.size);
        imageDraftContainer.classList.remove('hidden');
        draftImageLoading?.classList.add('hidden');
        draftImage?.parentElement?.classList.remove('is-loading');
        updateSendButtonState();
    };
    reader.onerror = () => {
        draftImageLoading?.classList.add('hidden');
        draftImage?.parentElement?.classList.remove('is-loading');
    };
    reader.readAsDataURL(file);
}

function clearImageDraft() {
    currentDraftImage = null;
    draftImage.src = '';
    imageDraftContainer.classList.add('hidden');
    imageInput.value = '';
    updateSendButtonState();
}

function openImagePreview() {
    if (!currentDraftImage?.dataURL || !imagePreviewModal || !imagePreviewFull) return;
    imagePreviewFull.src = currentDraftImage.dataURL;
    if (downloadPreviewBtn) {
        downloadPreviewBtn.href = currentDraftImage.dataURL;
        downloadPreviewBtn.setAttribute('download', currentDraftImage?.fileName || `youz-image-${Date.now()}.png`);
    }
    imagePreviewModal.classList.remove('hidden');
}

function closeImagePreview() {
    imagePreviewModal?.classList.add('hidden');
}

function openGeneratedImagePreview(imageUrl = '', fileName = '') {
    const safeUrl = String(imageUrl || '').trim();
    if (!safeUrl || !imagePreviewModal || !imagePreviewFull) return;
    imagePreviewFull.src = safeUrl;
    if (downloadPreviewBtn) {
        downloadPreviewBtn.href = safeUrl;
        downloadPreviewBtn.setAttribute('download', fileName || `youz-generated-${Date.now()}.png`);
    }
    imagePreviewModal.classList.remove('hidden');
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
    updateSendButtonState();
}

// ========== TYPING EFFECT ==========
function sanitizePartialMarkdown(text = '') {
    if (!text) return '';
    let safe = text;
    safe = safe.replace(/\[[^\]]*$/g, '');
    safe = safe.replace(/\([^)]*$/g, '');
    safe = safe.replace(/\*\*[^*]*$/g, '');
    safe = safe.replace(/\*[^*]*$/g, '');
    return safe;
}

async function typeWriterEffect(el, text, speed = 22) {
    el.innerHTML = '';
    const fullText = String(text || '');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        el.innerHTML = parseSimpleMarkdown(fullText);
        return;
    }
    let index = 0;
    let lastRendered = '';
    let lastFrameTime = performance.now();
    const minCharsPerFrame = 1;
    const maxCharsPerFrame = 5;
    const targetFrameMs = Math.max(14, Number(speed) || 22);

    return new Promise(resolve => {
        function renderFrame(now) {
            if (typingAbortRequested) {
                if (lastRendered) el.innerHTML = parseSimpleMarkdown(lastRendered);
                resolve();
                return;
            }

            if (index >= fullText.length) {
                el.innerHTML = parseSimpleMarkdown(fullText);
                resolve();
                return;
            }

            const elapsed = now - lastFrameTime;
            const adaptiveChars = Math.max(
                minCharsPerFrame,
                Math.min(maxCharsPerFrame, Math.floor(elapsed / targetFrameMs) || 1)
            );

            index = Math.min(fullText.length, index + adaptiveChars);
            const partial = sanitizePartialMarkdown(fullText.slice(0, index));
            const stablePartial = buildTypingPreviewMarkdown(partial);

            if (stablePartial !== lastRendered) {
                el.innerHTML = parseSimpleMarkdown(stablePartial);
                lastRendered = stablePartial;
                if (autoScrollDuringTyping) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }

            lastFrameTime = now;
            typingTimeout = requestAnimationFrame(renderFrame);
        }

        typingTimeout = requestAnimationFrame(renderFrame);
    });
}


async function streamChatSSE({ prompt, conversationId, signal }) {
    const qs = new URLSearchParams({ prompt: String(prompt || ''), conversationId: String(conversationId || ''), userId: currentUser?.id || '', email: currentUser?.email || '', modelType: activeModel });
    const response = await fetch(`/api/youz?mode=stream&${qs.toString()}`, { headers: { Accept: 'text/event-stream' }, signal });
    if (!response.ok || !response.body) {
        throw new Error(`Streaming gagal (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalContent = '';
    let doneConversationId = null;
    let errorMessage = null;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
            const line = chunk.split('\n').find(l => l.startsWith('data:'));
            if (!line) continue;
            let data = null;
            try {
                data = JSON.parse(line.slice(5).trim());
            } catch {
                continue;
            }
            if (!data || typeof data !== 'object') continue;
            if (data.type === 'token') finalContent = data.content || finalContent;
            if (data.type === 'error') errorMessage = data.message || 'Streaming gagal.';
            if (data.type === 'done') doneConversationId = data.conversationId || doneConversationId;
        }
    }
    if (errorMessage) return { success: false, content: errorMessage, model: activeModel, sources: [], conversationId: doneConversationId };
    return { success: true, content: finalContent, model: activeModel, sources: [], conversationId: doneConversationId };
}

// ========== SEND MESSAGE ==========
async function sendMessage(options = {}) {
    console.log('📤 sendMessage called');
    if (isProcessing && abortController) {
        typingAbortRequested = true;
        if (typingTimeout) {
            cancelAnimationFrame(typingTimeout);
            typingTimeout = null;
        }
        abortController.abort();
        window.setTimeout(() => {
            if (isProcessing) hardResetProcessingState();
        }, 120);
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
        content: text || ''
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
        updateSendButtonState();
    }
    clearImageDraft();
    
    const loadingId = 'loading-' + Date.now();
    const hasImageDraft = Boolean(userMessage.image);
    const wantsImageGeneration = !userMessage.image && shouldGenerateImageFromPrompt(text);
    const isImageGenLoading = wantsImageGeneration && !hasImageDraft;
    chatMessages.insertAdjacentHTML('beforeend', `
        <div class="message assistant pending ${isImageGenLoading ? 'image-gen' : ''}" id="${loadingId}">
            <div class="message-content-wrapper">
                <div class="message-content">
                    ${isImageGenLoading ? `
                        <div class="image-gen-loading">
                            <div class="image-gen-loading-head">
                                <div class="image-gen-loading-title">Membuat gambar</div>
                                <div class="image-gen-loading-ticker"><span>loading</span></div>
                            </div>
                            <div class="image-gen-loading-card" aria-hidden="true"></div>
                        </div>
                    ` : `
                        <div class="thinking-indicator">
                            <div class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></div>
                            <span>${hasImageDraft ? 'Memproses gambar...' : (thinkingModeEnabled ? 'AI sedang berpikir' : '•••')}</span>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        const thinkingStart = performance.now();
        const messages = conv.messages.map(m => ({ role: m.role, content: m.content }));
        const enableSearch = !userMessage.image && !wantsImageGeneration && shouldUseWebSearchFromPrompt(text);
        
        const action = wantsImageGeneration ? 'image' : (enableSearch ? 'search' : 'chat');
        let response;
        if (action === 'chat' && !userMessage.image) {
            response = await streamChatSSE({ prompt: text, conversationId: conv.serverId || '', signal: abortController.signal });
        } else {
            response = await callUnifiedAPI(
                messages,
                action,
                userMessage.image || null,
                text || 'Deskripsikan atau edit gambar ini.',
                enableSearch,
                conv.serverId || '',
                abortController.signal
            );
        }
        if (!response || typeof response !== 'object') {
            response = { success: false, content: 'Server mengirim respons tidak valid.' };
        }
        const thinkingMs = performance.now() - thinkingStart;
        
        document.getElementById(loadingId)?.remove();
        response.content = normalizeResponseText(response.content);

        if (response.limit) updateQuotaBadge(response.limit);
        if (response.conversationId) conv.serverId = response.conversationId;
        
        const aiMessage = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            role: 'assistant',
            content: '',
            model: response.model || (enableSearch ? 'web-search' : activeModel),
            hasSearch: Boolean(response.hasSearch) || enableSearch,
            searchTitle: enableSearch ? String(text || '').trim() : '',
            isError: !response.success,
            feedback: null,
            sources: mergeSources(response.sources || [], extractSourcesFromText(response.content || '')),
            isComplete: false,
            thinkingMs
        };
        if (response.imageUrl) {
            aiMessage.generatedImage = response.imageUrl;
        }
        
        conv.messages.push(aiMessage);
        conv.updatedAt = new Date().toISOString();
        saveToStorage();
        if (!response.imageUrl) renderMessages(conv.messages);
        
        const contentEl = document.getElementById(`msg-content-${conv.messages.length - 1}`);
        if (response.imageUrl && response.success) {
            aiMessage.content = '';
            aiMessage.isComplete = true;
            saveToStorage();
            renderMessages(conv.messages);
            return;
        }
        if (contentEl && response.success) {
            autoScrollDuringTyping = shouldStickToBottom();
            await typeWriterEffect(contentEl, response.content);
            aiMessage.content = normalizeResponseText(response.content || contentEl.textContent || '');
        } else {
            aiMessage.content = normalizeResponseText(response.content || 'Maaf, tidak ada respons.');
            if (contentEl) contentEl.innerHTML = parseSimpleMarkdown(aiMessage.content);
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
        typingAbortRequested = false;
        typingTimeout = null;
        setProcessingUI(false);
        messageInput.focus();
        updateSendButtonState();
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

function applyLanguage(lang, persist = true) {
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

    const loginBtn = document.querySelector('.sidebar-auth-link.cta');
    if (loginBtn) loginBtn.innerHTML = `<i class="fas fa-right-to-bracket"></i> ${t.loginPrompt}`;

    const loginNote = document.querySelector('.sidebar-auth-note');
    if (loginNote) loginNote.textContent = t.loginNote;
    
    if (persist) {
        localStorage.setItem('youz_language', lang);
        queueUserSettingsSave({ language: lang });
    }
    currentLanguage = lang;
    renderSidebar();
}

// ========== SEARCH SUGGESTIONS ==========
if (messageInput && searchSuggestions) {
    messageInput.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length > 2) {
            searchSuggestions.classList.remove('hidden');
            const suggestionItems = searchSuggestions.querySelectorAll('.suggestion-item');
            if (suggestionItems.length > 1) {
                suggestionItems[0].setAttribute('data-query', `${query} berita terbaru`);
                suggestionItems[0].innerHTML = `<i class="fas fa-newspaper"></i><span>"${query}" berita terbaru</span>`;
                suggestionItems[1].setAttribute('data-query', `${query} penjelasan`);
                suggestionItems[1].innerHTML = `<i class="fas fa-search"></i><span>"${query}" penjelasan</span>`;
            }
        } else {
            searchSuggestions.classList.add('hidden');
        }
    });
}

document.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
        messageInput.value = item.dataset.query;
        searchSuggestions.classList.add('hidden');
        sendMessage();
    });
});

// ========== EVENT LISTENERS ==========
hamburgerBtn?.addEventListener('click', () => {
    toggleSidebarVisibility();
});
closeSidebarBtn?.addEventListener('click', () => {
    toggleSidebarVisibility();
});
sidebarBackdrop?.addEventListener('click', () => {
    closeSidebarVisibility();
});

document.addEventListener('click', (e) => {
    if (searchSuggestions && e.target !== messageInput && !searchSuggestions.contains(e.target)) {
        searchSuggestions.classList.add('hidden');
    }
});

newChatBtn?.addEventListener('click', () => {
    createNewConversation();
    switchConversation(activeConversationId);
    if (isMobileViewport()) {
        closeSidebarVisibility();
    }
});

headerNewChatBtn?.addEventListener('click', () => {
    createNewConversation();
    switchConversation(activeConversationId);
    if (isMobileViewport()) {
        closeSidebarVisibility();
    }
});

sendBtn?.addEventListener('click', sendMessage);
sourcesBackdrop?.addEventListener('click', closeSourcesSheet);
sourcesCloseBtn?.addEventListener('click', closeSourcesSheet);
confirmBackdrop?.addEventListener('click', () => closeConfirmDialog(false));
confirmCancelBtn?.addEventListener('click', () => closeConfirmDialog(false));
confirmOkBtn?.addEventListener('click', () => closeConfirmDialog(true));

messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    updateSendButtonState();
});

attachBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleComposerMenu();
});

composerMenuBackdrop?.addEventListener('click', () => toggleComposerMenu(false));
composerMenu?.addEventListener('click', (e) => e.stopPropagation());
composerMenuPhoto?.addEventListener('click', () => {
    toggleComposerMenu(false);
    imageInput.click();
});

toolWebSearch?.addEventListener('change', (e) => {
    webSearchEnabled = e.target.checked;
    localStorage.setItem('youz_web_search_enabled', webSearchEnabled ? '1' : '0');
    queueUserSettingsSave({ web_search_enabled: webSearchEnabled });
    showToast(webSearchEnabled ? 'Web Search aktif' : 'Web Search mati', 'info', 1400);
});

toolThinking?.addEventListener('change', (e) => {
    thinkingModeEnabled = e.target.checked;
    localStorage.setItem('youz_thinking_enabled', thinkingModeEnabled ? '1' : '0');
    queueUserSettingsSave({ thinking_enabled: thinkingModeEnabled });
    showToast(thinkingModeEnabled ? 'Thinking mode aktif' : 'Thinking mode mati', 'info', 1400);
});


imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
        imageInput.value = '';
    }
});

removeDraftBtn?.addEventListener('click', clearImageDraft);

clearAllDataBtn?.addEventListener('click', () => {
    openConfirmDialog({
        title: 'Hapus semua percakapan?',
        message: 'Tindakan ini tidak dapat dibatalkan.',
        okText: 'Hapus semua',
        cancelText: 'Batal'
    }).then((ok) => {
        if (!ok) return;
        conversations = [];
        saveToStorage();
        createNewConversation();
        switchConversation(activeConversationId);
        showToast('Semua percakapan dihapus', 'success');
    });
});

// ========== SETTINGS MODAL EVENTS ==========

settingsCloseBtn?.addEventListener('click', closeSettings);

settingsOverlay?.addEventListener('click', closeSettings);

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
        queueUserSettingsSave({ theme: selected });
    }
}

themeLight?.addEventListener('click', () => {
    setThemePreference('light');
    showToast('Tema diperbarui', 'success');
});
themeDark?.addEventListener('click', () => {
    setThemePreference('dark');
    showToast('Tema diperbarui', 'success');
});
themeSystem?.addEventListener('click', () => {
    setThemePreference('system');
    showToast('Tema diperbarui', 'success');
});

languageSelect?.addEventListener('change', (e) => {
    applyLanguage(e.target.value);
    showToast('Bahasa diperbarui', 'success');
});


saveProfileBtn?.addEventListener('click', async () => {
    if (currentUser) {
        const payload = { name: profileName.value, email: profileEmail.value };
        const res = await fetch('/api/auth/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await readApiResponse(res);
        if (data?.success && data.user) currentUser = data.user;
        else currentUser.name = profileName.value;
        localStorage.setItem('youz_user', JSON.stringify(currentUser));
        updateUserUI();
        showToast(currentLanguage === 'id' ? 'Profil berhasil disimpan!' : 'Profile saved successfully!', 'success');
    }
});

clearAllDataBtn?.addEventListener('click', () => {
    const confirmMsg = currentLanguage === 'id' ? 
        'Hapus SEMUA percakapan? Tindakan ini tidak dapat dibatalkan.' : 
        'Delete ALL conversations? This action cannot be undone.';
    openConfirmDialog({
        title: currentLanguage === 'id' ? 'Hapus semua percakapan?' : 'Delete all conversations?',
        message: confirmMsg,
        okText: currentLanguage === 'id' ? 'Hapus semua' : 'Delete all',
        cancelText: currentLanguage === 'id' ? 'Batal' : 'Cancel'
    }).then((ok) => {
        if (!ok) return;
        conversations = [];
        saveToStorage();
        createNewConversation();
        switchConversation(activeConversationId);
        closeSettings();
        showToast(currentLanguage === 'id' ? 'Semua percakapan dihapus' : 'All conversations deleted', 'success');
    });
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
    showToast(currentLanguage === 'id' ? 'Data diekspor' : 'Data exported', 'success');
});

userProfileBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUser) {
        openSettings('profile');
        toggleUserMenu(false);
    } else {
        showToast(currentLanguage === 'id' ? 'Silakan login terlebih dahulu.' : 'Please login first.', 'info');
    }
});

userLogoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleUserMenu(false);
    logout();
});

userSettingsBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleUserMenu(false);
    window.location.href = '/settings';
});

userPremiumBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleUserMenu(false);
    window.location.href = '/premium';
});

userMenuBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleUserMenu();
});

scrollBottomBtn?.addEventListener('click', () => {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
});
imagePreviewBackdrop?.addEventListener('click', closeImagePreview);
closeImagePreviewBtn?.addEventListener('click', closeImagePreview);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imagePreviewModal && !imagePreviewModal.classList.contains('hidden')) {
        closeImagePreview();
    }
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
    if (composerMenu && attachBtn && !composerMenu.contains(e.target) && !attachBtn.contains(e.target)) {
        toggleComposerMenu(false);
    }
    if (toolsMenu && toolsBtn && !toolsMenu.contains(e.target) && !toolsBtn.contains(e.target)) {
        toolsMenu.classList.add('hidden');
    }
    if (modelSelectPanel && modelSelectBtn && !modelSelectPanel.contains(e.target) && !modelSelectBtn.contains(e.target)) {
        modelSelectPanel.classList.add('hidden');
    }
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target) && !sidebar.classList.contains('closed')) {
            closeSidebarVisibility();
        }
    }
});

let sidebarResizeTimer = null;
window.addEventListener('resize', () => {
    if (sidebarResizeTimer) window.clearTimeout(sidebarResizeTimer);
    sidebarResizeTimer = window.setTimeout(() => {
        applySidebarViewportDefaults();
    }, 120);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (confirmModal && !confirmModal.classList.contains('hidden')) {
            closeConfirmDialog(false);
            return;
        }
        if (sidebar && window.innerWidth <= 768 && !sidebar.classList.contains('closed')) {
            closeSidebarVisibility();
            return;
        }
        closeSourcesSheet();
    }
});

// ========== INIT ==========
async function init() {
    checkUserFromURL();
    await syncUserFromServer();
    await loadQuotaSnapshot();
    loadFromStorage();
    await syncHistoryFromServerIfEmpty();
    webSearchEnabled = localStorage.getItem('youz_web_search_enabled') !== '0';
    thinkingModeEnabled = localStorage.getItem('youz_thinking_enabled') !== '0';
    setActiveModel(localStorage.getItem('youz_model') || 'gemini', false);
    renderModelMenu();
    if (toolWebSearch) toolWebSearch.checked = webSearchEnabled;
    if (toolThinking) toolThinking.checked = thinkingModeEnabled;
    const routeParts = window.location.pathname.split('/').filter(Boolean);
    const routeId = routeParts[0] === 'c' && routeParts[1] && routeParts[1] !== 'new'
        ? decodeURIComponent(routeParts[1])
        : null;
    activeConversationId = (routeId && conversations.some((c) => c.id === routeId))
        ? routeId
        : (activeConversationId || conversations[0]?.id);
    renderSidebar();
    if (activeConversationId) {
        switchConversation(activeConversationId);
    } else {
        renderMessages([]);
    }
    updateScrollBottomVisibility();
    setProcessingUI(false);
    applySidebarViewportDefaults();
    
    if (currentTimeSpan) {
        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);
    }
    
    const savedTheme = localStorage.getItem('youz_theme') || 'system';
    setThemePreference(savedTheme, false);
    
    const savedLang = localStorage.getItem('youz_language') || 'id';
    applyLanguage(savedLang, false);
    if (languageSelect) languageSelect.value = savedLang;

    const serverSettings = await fetchUserSettings();
    if (serverSettings) {
        applyUserSettingsSnapshot(serverSettings);
        restoreConversationBackup(serverSettings);
    }
    
    if (window.location.pathname === '/' || window.location.pathname.startsWith('/c/')) {
        const activeConv = conversations.find((c) => c.id === activeConversationId);
        updateChatRoute(activeConv && activeConv.messages?.length ? activeConv.id : null, true);
    }
    refreshSettingsNotificationBadge();
    console.log('✅ Youz AI v2.8 initialized');
}

protectLogos();
init();

window.addEventListener('popstate', () => {
    const path = window.location.pathname;
    settingsModal.classList.add('hidden');
    if (!path.startsWith('/c/')) return;
    const slug = path.split('/')[2];
    if (slug === 'new') {
        const draft = conversations.find((c) => (c.messages || []).length === 0);
        if (draft) return switchConversation(draft.id);
        createNewConversation();
        return switchConversation(activeConversationId);
    }
    if (slug && conversations.some((c) => c.id === decodeURIComponent(slug))) {
        switchConversation(decodeURIComponent(slug));
    }
});

limitNoticeClose?.addEventListener('click', ()=> limitNotice?.classList.add('hidden'));
limitNoticeCta?.addEventListener('click', ()=> window.location.href='/pricing');


sendBtn && (sendBtn.disabled = true);
updateSendButtonState();
