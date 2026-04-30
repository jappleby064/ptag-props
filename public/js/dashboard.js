// Admin dashboard — report management

async function openDashboard() {
  document.getElementById('dashboard-modal-backdrop')?.remove();
  const el = document.createElement('div');
  el.id = 'dashboard-modal-backdrop';
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-header">
        <div class="modal-title">📋 Dashboard — Issue Reports</div>
        <button class="modal-close" onclick="closeModal('dashboard-modal-backdrop')">×</button>
      </div>
      <div class="modal-body">
        <div class="dash-tabs">
          <button class="dash-tab active" onclick="loadDashTab('open', this)">Open</button>
          <button class="dash-tab" onclick="loadDashTab('resolved', this)">Resolved</button>
          <button class="dash-tab" onclick="loadDashTab('all', this)">All</button>
        </div>
        <div id="dash-content" class="dash-content">
          <div class="loading-state"><div class="spinner"></div> Loading…</div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  loadDashTab('open');
}

async function loadDashTab(status, tabEl) {
  // Activate tab
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');

  const content = document.getElementById('dash-content');
  if (!content) return;
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading…</div>';

  try {
    const reports = await getReports(status);

    if (reports.length === 0) {
      content.innerHTML = `<div class="empty" style="padding:40px 0">
        <div class="empty-icon">${status === 'open' ? '✅' : '📭'}</div>
        <h3>${status === 'open' ? 'No open reports' : 'No reports yet'}</h3>
      </div>`;
      return;
    }

    // Group open reports by type
    const missing = reports.filter(r => r.type === 'missing' && !r.resolved);
    const broken  = reports.filter(r => r.type === 'broken'  && !r.resolved);
    const resolved = reports.filter(r => r.resolved);

    const summaryBar = status === 'open' ? `
      <div class="dash-summary">
        <div class="dash-summary-stat">
          <span class="dash-stat-num">${missing.length}</span>
          <span class="dash-stat-label">🔍 Missing</span>
        </div>
        <div class="dash-summary-stat">
          <span class="dash-stat-num">${broken.length}</span>
          <span class="dash-stat-label">🔧 Broken</span>
        </div>
      </div>` : '';

    content.innerHTML = summaryBar + `
      <div class="report-list">
        ${reports.map(r => renderReport(r)).join('')}
      </div>`;

    // Refresh badge after viewing
    refreshReportBadge();
  } catch (err) {
    content.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${escHtml(err.message)}</p></div>`;
  }
}

function renderReport(r) {
  const typeBadge = r.type === 'missing'
    ? `<span class="report-badge-type missing">🔍 Missing</span>`
    : `<span class="report-badge-type broken">🔧 Broken</span>`;

  const resolvedInfo = r.resolved ? `
    <div class="report-resolved-info">
      ✅ Resolved ${fmtDate(r.resolved_at)} by <strong>${escHtml(r.resolved_by)}</strong>
      ${r.resolve_note ? `<br><em>${escHtml(r.resolve_note)}</em>` : ''}
    </div>` : '';

  const actions = !r.resolved ? `
    <div class="report-actions">
      <button class="btn btn-sm btn-copper" onclick="doResolveReport(${r.id})">✅ Resolve</button>
      <button class="btn btn-sm btn-danger" onclick="doDeleteReport(${r.id})">🗑️</button>
    </div>` : `
    <div class="report-actions">
      <button class="btn btn-sm btn-outline" onclick="doDeleteReport(${r.id})">🗑️ Remove</button>
    </div>`;

  return `
    <div class="report-card${r.resolved ? ' report-card--resolved' : ''}" id="report-${r.id}">
      <div class="report-card-header">
        ${typeBadge}
        <strong class="report-item-link" onclick="openDetailModal(${r.item_id})">${escHtml(r.item_asset_id)} — ${escHtml(r.item_name)}</strong>
        <span class="report-date">${fmtDate(r.reported_at)}</span>
      </div>
      ${r.note ? `<div class="report-note">"${escHtml(r.note)}"</div>` : ''}
      ${resolvedInfo}
      ${actions}
    </div>`;
}

async function doResolveReport(id) {
  const note = prompt('Resolution note (optional):') ?? null;
  try {
    await resolveReport(id, note);
    toast('Report marked as resolved');
    // Reload current tab
    const activeTab = document.querySelector('.dash-tab.active');
    loadDashTab(activeTab?.textContent.trim().toLowerCase() || 'open', activeTab);
    refreshReportBadge();
  } catch (err) { toast(err.message, true); }
}

async function doDeleteReport(id) {
  if (!confirm('Delete this report permanently?')) return;
  try {
    await deleteReport(id);
    document.getElementById(`report-${id}`)?.remove();
    refreshReportBadge();
    toast('Report deleted');
  } catch (err) { toast(err.message, true); }
}
