// Shared UI utilities

function toast(message, isError = false) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function imageUrl(filename) { return filename ? `/uploads/${filename}` : null; }

function primaryImage(images) {
  if (!images || images.length === 0) return null;
  return images.find(i => i.is_primary) || images[0];
}

function typeChip(type) {
  const labels = { prop: 'Prop', furniture: 'Furniture', costume: 'Costume' };
  return `<span class="chip chip-${type}">${labels[type] || type}</span>`;
}
function categoryChip(cat) { return `<span class="chip chip-category">${escHtml(cat)}</span>`; }

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildCategoryOptions(type, selected = '') {
  const cats = (window.APP_STATE.categories[type] || []);
  if (cats.length === 0) return `<option value="">No categories — add in Settings</option>`;
  return cats.map(c =>
    `<option value="${escHtml(c)}" ${c === selected ? 'selected' : ''}>${escHtml(c)}</option>`
  ).join('');
}

function buildStorageOptions(selected = '') {
  const areas = window.APP_STATE.storageAreas || [];
  const base = `<option value="">— select —</option>`;
  return base + areas.map(a =>
    `<option value="${escHtml(a)}" ${a === selected ? 'selected' : ''}>${escHtml(a)}</option>`
  ).join('');
}

function renderCard(item, isAdmin = false) {
  const img = primaryImage(item.images);

  const flags = item.flags || {};
  const flagHtml = (flags.missing || flags.broken) ? `
    <div class="card-flag-badges">
      ${flags.missing ? '<span class="card-flag card-flag--missing">🔍 Missing</span>' : ''}
      ${flags.broken  ? '<span class="card-flag card-flag--broken">🔧 Broken</span>'   : ''}
    </div>` : '';

  const imgHtml = img
    ? `<div class="card-image" style="position:relative"><img src="${imageUrl(img.filename)}" alt="${escHtml(item.name)}" loading="lazy">${flagHtml}</div>`
    : `<div class="card-image card-image--empty" style="position:relative">${TYPE_ICONS[item.type] || '📦'}${flagHtml}</div>`;

  const adminActions = isAdmin ? `
    <div class="card-admin-actions" onclick="event.stopPropagation()">
      <button class="btn btn-outline btn-xs" onclick="openEditModal(${item.id})">✏️ Edit</button>
      <button class="btn btn-danger btn-xs" onclick="confirmDelete(${item.id},'${escHtml(item.name)}')">🗑️</button>
    </div>` : '';

  return `
    <div class="card" onclick="openDetailModal(${item.id})" data-id="${item.id}">
      ${imgHtml}
      <div class="card-body">
        <div class="card-asset-id">${item.asset_id}</div>
        <div class="card-name">${escHtml(item.name)}</div>
        <div class="card-meta">${typeChip(item.type)} ${categoryChip(item.item_category)}</div>
        ${item.storage_area ? `<div class="card-location">📍 ${escHtml(item.storage_area)}${item.storage_location ? ' · ' + escHtml(item.storage_location) : ''}</div>` : ''}
      </div>
      <div class="card-report-bar" onclick="event.stopPropagation()">
        <button class="btn-report btn-report--pick" onclick="togglePickingFromCard(${item.id},'${escHtml(item.name)}',event)">📋 Pick</button>
        <button class="btn-report" onclick="openReportModal(${item.id},'${escHtml(item.name)}','missing')">🔍 Report Missing</button>
        <button class="btn-report btn-report--broken" onclick="openReportModal(${item.id},'${escHtml(item.name)}','broken')">🔧 Report Broken</button>
      </div>
      ${adminActions}
    </div>`;
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ── Lightbox ───────────────────────────────────────────────────────────────
let _lbImages = [];
let _lbIndex  = 0;

function openLightbox(images, startIndex = 0) {
  document.getElementById('lightbox')?.remove();
  _lbImages = images;
  _lbIndex  = startIndex;

  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.className = 'lightbox';
  lb.innerHTML = `
    <button class="lightbox-close" onclick="document.getElementById('lightbox').remove()">×</button>
    <img id="lb-img" src="" alt="">
    ${images.length > 1 ? `
      <button class="lightbox-nav lightbox-nav--prev" onclick="lbNav(-1)">&#8249;</button>
      <button class="lightbox-nav lightbox-nav--next" onclick="lbNav(1)">&#8250;</button>
      <div class="lightbox-counter" id="lb-counter"></div>` : ''}`;

  lb.addEventListener('click', e => {
    if (e.target === lb) lb.remove();
  });
  document.body.appendChild(lb);
  lbShow();
}

function lbShow() {
  const img = document.getElementById('lb-img');
  if (img) img.src = imageUrl(_lbImages[_lbIndex].filename);
  const counter = document.getElementById('lb-counter');
  if (counter) counter.textContent = `${_lbIndex + 1} / ${_lbImages.length}`;
}

function lbNav(dir) {
  _lbIndex = (_lbIndex + dir + _lbImages.length) % _lbImages.length;
  lbShow();
}

document.addEventListener('keydown', e => {
  if (!document.getElementById('lightbox')) return;
  if (e.key === 'ArrowRight') lbNav(1);
  if (e.key === 'ArrowLeft')  lbNav(-1);
  if (e.key === 'Escape')     document.getElementById('lightbox')?.remove();
});

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) e.target.remove();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Lightbox takes priority
    if (document.getElementById('lightbox')) { document.getElementById('lightbox').remove(); return; }
    const backdrops = document.querySelectorAll('.modal-backdrop');
    if (backdrops.length) backdrops[backdrops.length - 1].remove();
  }
});
