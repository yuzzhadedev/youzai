const adminKpis = document.getElementById('adminKpis');
const requestTableBody = document.querySelector('#requestTable tbody');
const premiumUserTableBody = document.querySelector('#premiumUserTable tbody');
const chatHistoryList = document.getElementById('chatHistoryList');
const adminStatus = document.getElementById('adminStatus');
const refreshAdminBtn = document.getElementById('refreshAdminBtn');

function escapeHtml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setStatus(msg, type = 'info') {
  adminStatus.textContent = msg;
  adminStatus.dataset.state = type;
}

async function loadAdminData() {
  setStatus('Memuat data admin...');
  try {
    const res = await fetch('/api/settings?scope=admin');
    const data = await res.json();
    if (!res.ok || !data?.success) throw new Error(data?.message || 'Gagal memuat data admin.');

    renderOverview(data.data?.overview || {});
    renderRequests(data.data?.latest_premium_requests || []);
    renderPremiumUsers(data.data?.premium_users || []);
    renderChatHistory(data.data?.recent_chat_history || []);
    setStatus('Data admin berhasil dimuat.', 'success');
  } catch (error) {
    setStatus(error.message || 'Terjadi kesalahan saat load data admin.', 'error');
  }
}

function renderOverview(overview) {
  const items = [
    ['Pending Requests', overview.pending_requests || 0],
    ['Active Premium', overview.active_premium_users || 0],
    ['Total Requests', overview.total_premium_requests || 0],
    ['Chat Logged', overview.chat_messages_logged || 0],
    ['Usage Rows', overview.usage_rows || 0]
  ];
  adminKpis.innerHTML = items.map(([label, value]) => `<div class="admin-kpi"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderRequests(requests) {
  requestTableBody.innerHTML = requests.map((item) => {
    const userKey = item?.user_key || item?.userKey || '';
    const isPending = String(item?.status || 'pending').toLowerCase() === 'pending';
    return `<tr>
      <td>${escapeHtml(item?.email || userKey)}</td>
      <td>${escapeHtml(item?.method || '-')}</td>
      <td>${escapeHtml(item?.status || 'pending')}</td>
      <td>${escapeHtml(item?.notes || '-')}</td>
      <td>${isPending ? `<button class="admin-btn tiny" data-approve="${escapeHtml(userKey)}">Approve 1 Bulan</button>` : '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">Tidak ada data.</td></tr>';

  requestTableBody.querySelectorAll('button[data-approve]').forEach((btn) => {
    btn.addEventListener('click', () => approvePremium(btn.dataset.approve));
  });
}

function renderPremiumUsers(users) {
  premiumUserTableBody.innerHTML = users.map((item) => `<tr>
      <td>${escapeHtml(item?.user_key || '-')}</td>
      <td>${escapeHtml(item?.status || '-')}</td>
      <td>${escapeHtml(item?.plan_name || 'premium')}</td>
      <td>${escapeHtml(item?.expires_at || '-')}</td>
    </tr>`).join('') || '<tr><td colspan="4">Tidak ada user premium.</td></tr>';
}

function renderChatHistory(history) {
  chatHistoryList.innerHTML = history.map((item) => `<div class="admin-list-item">
      <div><strong>${escapeHtml(item?.role || 'unknown')}</strong> · ${escapeHtml(item?.conversation_id || '-')}</div>
      <p>${escapeHtml((item?.content || '').slice(0, 280) || '-')}</p>
    </div>`).join('') || '<div class="admin-list-item">Belum ada chat history.</div>';
}

async function approvePremium(targetUserKey) {
  if (!targetUserKey) return;
  setStatus(`Mengaktifkan premium untuk ${targetUserKey}...`);
  try {
    const res = await fetch('/api/settings?scope=admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_premium', targetUserKey, months: 1 })
    });
    const data = await res.json();
    if (!res.ok || !data?.success) throw new Error(data?.message || 'Gagal approve premium.');
    setStatus(`Premium aktif untuk ${targetUserKey}.`, 'success');
    await loadAdminData();
  } catch (error) {
    setStatus(error.message || 'Gagal approve premium.', 'error');
  }
}

refreshAdminBtn?.addEventListener('click', loadAdminData);
loadAdminData();
