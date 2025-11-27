window.AdminUsers = (function() {
  let tableBody, pagination, searchInput, sortSelect, rankFilter;
  // Drawer elements
  let drawerEl, drawerBackdrop, drawerCloseBtn;
  let drawerTitle, drawerName, drawerUsername, drawerRank, drawerCreated, drawerLastUpdated, drawerEvalCount, recentActivityList;
  // Edit modal elements
  let editModalEl, editBackdrop, editCancelBtn, editSaveBtn, editNameInput, editUsernameInput, editRankInput, editStatusEl;
  let editingUser = null;
  // Delete modal elements
  let deleteModalEl, deleteBackdrop, deleteCancelBtn, deleteConfirmBtn, deleteConfirmInput, deleteStatusEl, hardDeleteCheckbox;
  let deletingUser = null;
  let toastContainer = null;
  // Evaluation viewer elements
  let evalModalEl, evalBackdrop, evalCloseBtn, evalModalTitle, evalOccasion, evalCompleted, evalAverage, evalMarine, evalRS, evalComments, evalTraits;
  let currentPage = 1;
  const pageSize = 20;
  let totalItems = 0;
  let currentQuery = '';
  let currentSort = 'name';

  /**
   *
   */
  function init() {
    tableBody = document.querySelector('#usersTable tbody');
    pagination = document.getElementById('usersPagination');
    searchInput = document.getElementById('searchInput');
    sortSelect = document.getElementById('sortSelect');
    rankFilter = document.getElementById('rankFilter');
    // Drawer refs
    drawerEl = document.getElementById('userDrawer');
    drawerBackdrop = drawerEl ? drawerEl.querySelector('.drawer-backdrop') : null;
    drawerCloseBtn = document.getElementById('drawerCloseBtn');
    drawerTitle = document.getElementById('drawerTitle');
    drawerName = document.getElementById('drawerName');
    drawerUsername = document.getElementById('drawerUsername');
    drawerRank = document.getElementById('drawerRank');
    drawerCreated = document.getElementById('drawerCreated');
    drawerLastUpdated = document.getElementById('drawerLastUpdated');
    drawerEvalCount = document.getElementById('drawerEvalCount');
    recentActivityList = document.getElementById('recentActivityList');
    // Edit modal refs
    editModalEl = document.getElementById('editUserModal');
    editBackdrop = editModalEl ? editModalEl.querySelector('.modal-backdrop') : null;
    editCancelBtn = document.getElementById('editCancelBtn');
    editSaveBtn = document.getElementById('editSaveBtn');
    editNameInput = document.getElementById('editNameInput');
    editUsernameInput = document.getElementById('editUsernameInput');
    editRankInput = document.getElementById('editRankInput');
    editStatusEl = document.getElementById('editStatus');
    // Delete modal refs
    deleteModalEl = document.getElementById('deleteUserModal');
    deleteBackdrop = deleteModalEl ? deleteModalEl.querySelector('.modal-backdrop') : null;
    deleteCancelBtn = document.getElementById('deleteCancelBtn');
    deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    deleteConfirmInput = document.getElementById('deleteConfirmInput');
    deleteStatusEl = document.getElementById('deleteStatus');
    hardDeleteCheckbox = document.getElementById('hardDeleteCheckbox');
    // Toasts
    toastContainer = document.getElementById('toastContainer');
    // Evaluation viewer refs
    evalModalEl = document.getElementById('evaluationModal');
    evalBackdrop = evalModalEl ? evalModalEl.querySelector('.modal-backdrop') : null;
    evalCloseBtn = document.getElementById('evalCloseBtn');
    evalModalTitle = document.getElementById('evalModalTitle');
    evalOccasion = document.getElementById('evalOccasion');
    evalCompleted = document.getElementById('evalCompleted');
    evalAverage = document.getElementById('evalAverage');
    evalMarine = document.getElementById('evalMarine');
    evalRS = document.getElementById('evalRS');
    evalComments = document.getElementById('evalComments');
    evalTraits = document.getElementById('evalTraits');
    renderPlaceholder();
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        currentQuery = (searchInput.value || '').trim();
        currentPage = 1;
        load();
      }, 250));
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value || 'name';
        currentPage = 1;
        load();
      });
    }
    if (rankFilter) {
      rankFilter.addEventListener('change', () => {
        currentPage = 1;
        load();
      });
      populateRankOptions();
    }
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });
    // Edit modal events
    if (editBackdrop) editBackdrop.addEventListener('click', closeEditModal);
    if (editCancelBtn) editCancelBtn.addEventListener('click', closeEditModal);
    if (editSaveBtn) editSaveBtn.addEventListener('click', saveEdit);
    // Delete modal events
    if (deleteBackdrop) deleteBackdrop.addEventListener('click', closeDeleteModal);
    if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteModal);
    if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', confirmDelete);
    // Evaluation viewer events
    if (evalBackdrop) evalBackdrop.addEventListener('click', closeEvaluationModal);
    if (evalCloseBtn) evalCloseBtn.addEventListener('click', closeEvaluationModal);
  }

  /**
   *
   * @param page
   */
  async function load(page) {
    if (typeof page === 'number') currentPage = Math.max(1, page);
    try {
      const q = encodeURIComponent(currentQuery);
      const sort = encodeURIComponent(currentSort);
      const rank = encodeURIComponent(rankFilter && rankFilter.value ? rankFilter.value : '');
      const path = `/users/list?page=${currentPage}&pageSize=${pageSize}&q=${q}&sort=${sort}&rank=${rank}`;
      const res = await window.AdminAPI.get(path);
      if (!res || res.ok !== true) throw new Error('Load failed');
      totalItems = res.total || 0;
      renderTable(res.users || []);
      renderPagination();
    } catch (err) {
      renderError('Failed to load users');
    }
  }

  /**
   *
   */
  async function populateRankOptions() {
    try {
      const eng = await window.AdminAPI.get('/metrics/engagement');
      const dist = eng && eng.userRankDistribution ? eng.userRankDistribution : {};
      const ranks = Object.keys(dist);
      ranks.sort((a, b) => (dist[b] || 0) - (dist[a] || 0));
      if (rankFilter) {
        // Reset options except first
        while (rankFilter.options.length > 1) rankFilter.remove(1);
        ranks.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r;
          opt.textContent = r;
          rankFilter.appendChild(opt);
        });
      }
    } catch (_) { /* ignore */ }
  }

  /**
   *
   */
  function renderPlaceholder() {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8" style="color:#9aa7b8">No data loaded yet</td>';
    tableBody.appendChild(row);
  }

  /**
   *
   * @param message
   */
  function renderError(message) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="8" style="color:#b24">${message}</td>`;
    tableBody.appendChild(row);
    if (pagination) pagination.textContent = '';
  }

  /**
   *
   * @param users
   */
  function renderTable(users) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!Array.isArray(users) || users.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="8" style="color:#9aa7b8">No matching users</td>';
      tableBody.appendChild(row);
      return;
    }
    for (const u of users) {
      const tr = document.createElement('tr');
      const createdStr = safeDate(u.created);
      const status = u.status || '—';
      const typeText = (u.type || (u.isAdmin ? 'Admin' : 'User') || 'User');
      const cols = [
        u.rank || '—',
        u.name || '—',
        u.username || '—',
        createdStr,
        Number.isFinite(u.evalCount) ? String(u.evalCount) : '—',
        status,
        typeText
      ];
      for (const c of cols) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      // Actions column
      const actionTd = document.createElement('td');
      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'View';
      viewBtn.title = 'View details and recent activity';
      viewBtn.addEventListener('click', () => openUserDrawer(u));
      actionTd.appendChild(viewBtn);
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.style.marginLeft = '8px';
      editBtn.title = 'Edit user profile';
      editBtn.addEventListener('click', () => openEditModal(u));
      actionTd.appendChild(editBtn);
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.style.marginLeft = '8px';
      delBtn.title = 'Delete user (soft-delete)';
      delBtn.addEventListener('click', () => openDeleteModal(u));
      actionTd.appendChild(delBtn);
      tr.appendChild(actionTd);
      tableBody.appendChild(tr);
    }
  }

  /**
   *
   */
  function renderPagination() {
    if (!pagination) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= totalPages;
    pagination.innerHTML = '';
    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Prev';
    prevBtn.disabled = prevDisabled;
    prevBtn.addEventListener('click', () => load(currentPage - 1));
    const info = document.createElement('span');
    info.textContent = ` Page ${currentPage} of ${totalPages} `;
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.disabled = nextDisabled;
    nextBtn.addEventListener('click', () => load(currentPage + 1));
    pagination.appendChild(prevBtn);
    pagination.appendChild(info);
    pagination.appendChild(nextBtn);
  }

  /**
   *
   * @param str
   */
  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   *
   * @param str
   */
  function safeDate(str) {
    const ts = Date.parse(str || '');
    if (!Number.isFinite(ts) || ts <= 0) return '—';
    try { return new Date(ts).toLocaleDateString(); } catch (_) { return '—'; }
  }

  /**
   *
   * @param fn
   * @param ms
   */
  function debounce(fn, ms) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /**
   *
   * @param user
   */
  function openUserDrawer(user) {
    if (!drawerEl) return;
    // Populate fields
    if (drawerTitle) drawerTitle.textContent = `${user.name || '—'} (${user.username || '—'})`;
    if (drawerName) drawerName.textContent = user.name || '—';
    if (drawerUsername) drawerUsername.textContent = user.username || '—';
    if (drawerRank) drawerRank.textContent = user.rank || '—';
    if (drawerCreated) drawerCreated.textContent = safeDate(user.created);
    if (drawerLastUpdated) drawerLastUpdated.textContent = safeDate(user.lastUpdated);
    if (drawerEvalCount) drawerEvalCount.textContent = Number.isFinite(user.evalCount) ? String(user.evalCount) : '—';
    // Reset recent activity list
    if (recentActivityList) {
      recentActivityList.innerHTML = '<li style="color:#9aa7b8">Loading…</li>';
    }
    // Show drawer
    drawerEl.style.display = 'block';
    drawerEl.classList.remove('hidden');
    // Fetch recent evaluations
    loadRecentActivity(user).catch(() => {
      if (recentActivityList) {
        recentActivityList.innerHTML = '<li style="color:#b24">Failed to load recent activity</li>';
      }
    });
  }

  /**
   *
   * @param user
   */
  async function loadRecentActivity(user) {
    const username = String(user?.username || '').trim();
    if (!username) {
      if (recentActivityList) recentActivityList.innerHTML = '<li style="color:#9aa7b8">No username</li>';
      return;
    }
    const LIST_ROUTE = (window.CONSTANTS?.ROUTES?.API?.EVALUATIONS_LIST) || '/api/evaluations/list';
    const resp = await fetch(`${LIST_ROUTE}?username=${encodeURIComponent(username)}`, { credentials: 'include' });
    if (!resp.ok) throw new Error('eval list failed');
    const data = await resp.json();
    const evals = Array.isArray(data.evaluations) ? data.evaluations : [];
    // Sort by completedDate desc
    evals.sort((a, b) => (Date.parse(b.completedDate || '') || 0) - (Date.parse(a.completedDate || '') || 0));
    const top = evals.slice(0, 5);
    if (!recentActivityList) return;
    recentActivityList.innerHTML = '';
    if (top.length === 0) {
      recentActivityList.innerHTML = '<li style="color:#9aa7b8">No recent activity</li>';
      return;
    }
    for (const ev of top) {
      const li = document.createElement('li');
      const dateStr = safeDate(ev.completedDate);
      const occasion = (ev.occasion || ev?.marineInfo?.occasion || ev?.rsInfo?.occasion || '') || '';
      const avg = (ev.fitrepAverage != null) ? ` — Avg ${String(ev.fitrepAverage)}` : '';
      const text = document.createElement('span');
      text.textContent = `${dateStr} — ${occasion || 'Evaluation'}${avg}`;
      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'View';
      viewBtn.style.marginLeft = '8px';
      viewBtn.addEventListener('click', () => openEvaluationModal(ev));
      li.appendChild(text);
      li.appendChild(viewBtn);
      recentActivityList.appendChild(li);
    }
  }

  /**
   *
   * @param ev
   */
  function openEvaluationModal(ev) {
    if (!evalModalEl) return;
    try {
      const occ = ev?.occasion || '';
      const completed = safeDate(ev?.completedDate);
      const avg = (ev?.fitrepAverage != null) ? String(ev.fitrepAverage) : '—';
      const marineName = ev?.marineInfo?.name || '';
      const marineRank = ev?.marineInfo?.rank || '';
      const period = ev?.marineInfo?.evaluationPeriod ? `${ev.marineInfo.evaluationPeriod.from || ''} - ${ev.marineInfo.evaluationPeriod.to || ''}` : '';
      const rsName = ev?.rsInfo?.name || '';
      const rsRank = ev?.rsInfo?.rank || '';

      if (evalModalTitle) evalModalTitle.textContent = `Evaluation — ${occ || 'Occasion'} (${completed})`;
      if (evalOccasion) evalOccasion.textContent = occ || '—';
      if (evalCompleted) evalCompleted.textContent = completed || '—';
      if (evalAverage) {
        evalAverage.textContent = avg;
        evalAverage.style.color = (Number(avg) >= 4.5) ? '#0a7f3f' : (Number(avg) <= 3.0 ? '#a32020' : '#111827');
      }
      if (evalMarine) evalMarine.textContent = `${marineName || '—'} ${marineRank ? `(${marineRank})` : ''}${period ? ` — ${period}` : ''}`;
      if (evalRS) evalRS.textContent = `${rsName || '—'} ${rsRank ? `(${rsRank})` : ''}`;
      if (evalComments) evalComments.textContent = ev?.sectionIComments || '—';
      if (evalTraits) {
        evalTraits.innerHTML = '';
        const traits = Array.isArray(ev?.traitEvaluations) ? ev.traitEvaluations : [];
        if (traits.length === 0) {
          const none = document.createElement('div');
          none.style.color = '#6b7280';
          none.textContent = 'No trait details available.';
          evalTraits.appendChild(none);
        } else {
          for (const t of traits) {
            const item = document.createElement('div');
            const grade = t?.grade != null ? String(t.grade) : '—';
            item.style.border = '1px solid #e5e7eb';
            item.style.borderRadius = '6px';
            item.style.padding = '6px 8px';
            item.innerHTML = `<div style="font-weight:600;">${escapeHtml(t?.trait || 'Trait')}</div><div>Grade: <span style="font-weight:600;">${escapeHtml(grade)}</span></div><div style="color:#6b7280;">${escapeHtml(t?.justification || '')}</div>`;
            evalTraits.appendChild(item);
          }
        }
      }
      evalModalEl.style.display = 'block';
      evalModalEl.classList.remove('hidden');
    } catch (e) {
      showToast('Failed to display evaluation', 'error');
    }
  }

  /**
   *
   */
  function closeEvaluationModal() {
    if (!evalModalEl) return;
    evalModalEl.classList.add('hidden');
    evalModalEl.style.display = 'none';
  }

  /**
   *
   */
  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.add('hidden');
    drawerEl.style.display = 'none';
  }

  /**
   *
   * @param user
   */
  function openEditModal(user) {
    if (!editModalEl) return;
    editingUser = user || null;
    // Prefill
    if (editNameInput) editNameInput.value = user?.name || '';
    if (editUsernameInput) editUsernameInput.value = user?.username || '';
    if (editRankInput) editRankInput.value = user?.rank || '';
    if (editStatusEl) editStatusEl.textContent = '—';
    editModalEl.style.display = 'block';
    editModalEl.classList.remove('hidden');
  }

  /**
   *
   */
  function closeEditModal() {
    if (!editModalEl) return;
    editModalEl.classList.add('hidden');
    editModalEl.style.display = 'none';
    editingUser = null;
  }

  /**
   *
   * @param username
   */
  async function checkAvailability(username) {
    const u = String(username || '').trim();
    if (!u) return { ok: false, error: 'Missing username' };
    try {
      const AVAIL_ROUTE = (window.CONSTANTS?.ROUTES?.API?.ACCOUNT_AVAILABLE) || '/api/account/available';
      const resp = await fetch(`${AVAIL_ROUTE}?username=${encodeURIComponent(u)}`, { credentials: 'include' });
      if (!resp.ok) return { ok: false, error: `Availability check failed (${resp.status})` };
      const data = await resp.json();
      return { ok: true, available: !!data.available };
    } catch (e) {
      return { ok: false, error: e?.message || 'Network error' };
    }
  }

  /**
   *
   * @param username
   */
  function isValidUsername(username) {
    return /^[a-zA-Z0-9._-]{3,50}$/.test(String(username || ''));
  }

  /**
   *
   */
  async function saveEdit() {
    if (!editingUser) return;
    const name = String(editNameInput?.value || '').trim();
    const username = String(editUsernameInput?.value || '').trim();
    const rank = String(editRankInput?.value || '').trim();
    const prev = String(editingUser?.username || '').trim();
    // Basic validation
    if (!name || name.length < 2) {
      if (editStatusEl) editStatusEl.textContent = 'Name looks invalid.';
      return;
    }
    if (!isValidUsername(username)) {
      if (editStatusEl) editStatusEl.textContent = 'Username must be 3-50 chars (alphanumeric, . _ -).';
      return;
    }
    if (!rank) {
      if (editStatusEl) editStatusEl.textContent = 'Rank is required.';
      return;
    }
    if (username.toLowerCase() !== prev.toLowerCase()) {
      const avail = await checkAvailability(username);
      if (!avail.ok) {
        if (editStatusEl) editStatusEl.textContent = avail.error || 'Availability check failed.';
        return;
      }
      if (!avail.available) {
        if (editStatusEl) editStatusEl.textContent = 'Username is already taken.';
        return;
      }
    }
    if (editStatusEl) editStatusEl.textContent = 'Saving…';
    try {
      const body = { userData: { rsName: name, rsEmail: username, rsRank: rank, previousEmail: prev } };
      const SAVE_ROUTE = (window.CONSTANTS?.ROUTES?.API?.USER_SAVE) || '/api/user/save';
      const resp = await fetch(SAVE_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`Save failed (${resp.status})`);
      const data = await resp.json();
      if (!data || data.ok !== true) throw new Error('Save failed');
      if (editStatusEl) editStatusEl.textContent = 'Saved successfully.';
      showToast('User saved successfully', 'success');
      // Refresh table and close
      await load(1);
      closeEditModal();
    } catch (e) {
      const msg = e?.message || 'Save failed.';
      if (editStatusEl) editStatusEl.textContent = msg;
      showToast(msg, 'error');
    }
  }

  /**
   *
   * @param user
   */
  function openDeleteModal(user) {
    if (!deleteModalEl) return;
    deletingUser = user || null;
    if (deleteConfirmInput) deleteConfirmInput.value = '';
    if (deleteStatusEl) deleteStatusEl.textContent = '—';
    if (hardDeleteCheckbox) hardDeleteCheckbox.checked = false;
    deleteModalEl.style.display = 'block';
    deleteModalEl.classList.remove('hidden');
  }

  /**
   *
   */
  function closeDeleteModal() {
    if (!deleteModalEl) return;
    deleteModalEl.classList.add('hidden');
    deleteModalEl.style.display = 'none';
    deletingUser = null;
  }

  /**
   *
   */
  async function confirmDelete() {
    const expected = String(deletingUser?.username || '').trim();
    const typed = String(deleteConfirmInput?.value || '').trim();
    if (!expected) {
      if (deleteStatusEl) deleteStatusEl.textContent = 'No user selected.';
      return;
    }
    if (typed.toLowerCase() !== expected.toLowerCase()) {
      if (deleteStatusEl) deleteStatusEl.textContent = 'Username does not match.';
      return;
    }
    if (deleteStatusEl) deleteStatusEl.textContent = 'Deleting…';
    try {
      const hard = !!(hardDeleteCheckbox && hardDeleteCheckbox.checked);
      const ADMIN_BASE = (window.CONSTANTS?.ROUTES?.API?.ADMIN_BASE) || '/api/admin';
      const url = hard ? `${ADMIN_BASE}/users/${encodeURIComponent(expected)}/hard` : `${ADMIN_BASE}/users/${encodeURIComponent(expected)}`;
      const resp = await fetch(url, { method: 'DELETE', credentials: 'include' });
      if (!resp.ok) throw new Error(`Delete failed (${resp.status})`);
      const data = await resp.json();
      if (!data || data.ok !== true) throw new Error('Delete failed');
      if (deleteStatusEl) deleteStatusEl.textContent = 'Deleted successfully.';
      showToast(hard ? 'User permanently deleted' : 'User soft-deleted', 'success');
      await load(1);
      closeDeleteModal();
    } catch (e) {
      const msg = e?.message || 'Delete failed.';
      if (deleteStatusEl) deleteStatusEl.textContent = msg;
      showToast(msg, 'error');
    }
  }

  // Simple toast helper
  /**
   *
   * @param message
   * @param type
   */
  function showToast(message, type) {
    try {
      if (!toastContainer) return;
      const el = document.createElement('div');
      el.className = `toast ${type === 'success' ? 'success' : (type === 'error' ? 'error' : '')}`;
      el.textContent = String(message || '');
      toastContainer.appendChild(el);
      // Force paint then show for transition
      requestAnimationFrame(() => { el.classList.add('show'); });
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => { try { el.remove(); } catch (_) {} }, 200);
      }, 4000);
    } catch (_) { /* ignore */ }
  }

  return { init, load };
})();
