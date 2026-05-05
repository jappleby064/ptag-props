// Picking list — temporary in-browser list of items the user wants to pick.
// Stored in localStorage; export via the browser print dialog (save as PDF).

const PICKING_KEY = 'ptag_picking_list';

function getPickingList() {
  try { return JSON.parse(localStorage.getItem(PICKING_KEY)) || []; }
  catch { return []; }
}

function setPickingList(ids) {
  localStorage.setItem(PICKING_KEY, JSON.stringify(ids));
  updatePickingBadge();
}

function isInPickingList(id) {
  return getPickingList().includes(id);
}

function addToPicking(id, name) {
  const list = getPickingList();
  if (list.includes(id)) {
    toast(`"${name}" already on picking list`);
    return;
  }
  list.push(id);
  setPickingList(list);
  toast(`Added "${name}" to picking list`);
  // Re-render the card if it's on screen so its button updates
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) card.classList.add('on-picking-list');
}

function removeFromPicking(id) {
  setPickingList(getPickingList().filter(x => x !== id));
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) card.classList.remove('on-picking-list');
}

function clearPickingList() {
  if (!confirm('Clear the entire picking list?')) return;
  setPickingList([]);
  renderPickingModal();
  document.querySelectorAll('.card.on-picking-list').forEach(c => c.classList.remove('on-picking-list'));
}

function togglePickingFromCard(id, name, event) {
  event?.stopPropagation();
  if (isInPickingList(id)) {
    removeFromPicking(id);
    toast(`Removed "${name}" from picking list`);
  } else {
    addToPicking(id, name);
  }
}

function updatePickingBadge() {
  const badge = document.getElementById('picking-fab-badge');
  const list = getPickingList();
  if (!badge) return;
  if (list.length === 0) {
    badge.classList.add('hidden');
  } else {
    badge.textContent = list.length;
    badge.classList.remove('hidden');
  }
}

function setupPickingFab() {
  if (document.getElementById('picking-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'picking-fab';
  fab.className = 'picking-fab';
  fab.title = 'Picking list';
  fab.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4"></path>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
    <span>Picking List</span>
    <span id="picking-fab-badge" class="picking-fab-badge hidden">0</span>`;
  fab.addEventListener('click', openPickingModal);
  document.body.appendChild(fab);
  updatePickingBadge();
}

async function openPickingModal() {
  document.getElementById('picking-modal-backdrop')?.remove();
  const el = document.createElement('div');
  el.id = 'picking-modal-backdrop';
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Picking List</div>
        <button class="modal-close" onclick="closeModal('picking-modal-backdrop')">×</button>
      </div>
      <div class="modal-body" id="picking-modal-body">
        <div class="loading-state"><div class="spinner"></div> Loading…</div>
      </div>
    </div>`;
  document.body.appendChild(el);
  await renderPickingModal();
}

async function renderPickingModal() {
  const body = document.getElementById('picking-modal-body');
  if (!body) return;
  const ids = getPickingList();
  if (ids.length === 0) {
    body.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📋</div>
        <h3>Your picking list is empty</h3>
        <p>Open any item and click "Add to picking list" to start building a list.</p>
      </div>`;
    return;
  }

  // Resolve items (best-effort; tolerate deletions)
  const items = await Promise.all(ids.map(id => getItem(id).catch(() => null)));
  const resolved = items.map((item, i) => ({ id: ids[i], item }));

  const groups = groupPickingByType(resolved);

  body.innerHTML = `
    <div class="picking-toolbar">
      <span class="text-dim">${ids.length} item${ids.length !== 1 ? 's' : ''} on list</span>
      <div class="picking-toolbar-actions">
        <button class="btn btn-outline btn-sm" onclick="clearPickingList()">Clear all</button>
        <button class="btn btn-copper btn-sm" onclick="printPickingList()">🖨️ Print / Save PDF</button>
      </div>
    </div>
    ${groups.map(g => `
      <div class="picking-group">
        <h3 class="picking-group-heading">${TYPE_ICONS[g.type] || '📦'} ${g.label} <span class="text-dim">(${g.entries.length})</span></h3>
        <ul class="picking-rows">
          ${g.entries.map(({ id, item }) => renderPickingRow(id, item)).join('')}
        </ul>
      </div>
    `).join('')}`;
}

// Group resolved picking entries by item type, in fixed order.
// Unknown / missing items go in an "Other" bucket at the end.
const PICKING_TYPE_ORDER = ['prop', 'furniture', 'costume'];
function groupPickingByType(resolved) {
  const buckets = new Map();
  for (const entry of resolved) {
    const t = entry.item?.type || 'other';
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(entry);
  }
  const groups = [];
  for (const t of PICKING_TYPE_ORDER) {
    if (buckets.has(t)) {
      groups.push({ type: t, label: pluralTypeLabel(t), entries: buckets.get(t) });
      buckets.delete(t);
    }
  }
  for (const [t, entries] of buckets) {
    groups.push({ type: t, label: t === 'other' ? 'Other' : pluralTypeLabel(t), entries });
  }
  return groups;
}

function pluralTypeLabel(type) {
  const base = TYPE_LABELS[type] || type;
  return base.endsWith('s') ? base : base + 's';
}

function renderPickingRow(id, item) {
  if (!item) {
    return `
      <li class="picking-row picking-row--missing">
        <div class="picking-row-thumb picking-row-thumb--empty">⚠️</div>
        <div class="picking-row-body">
          <div class="picking-row-name">Item no longer in inventory</div>
          <div class="text-dim">ID #${id}</div>
        </div>
        <button class="btn btn-outline btn-xs" onclick="removeFromPicking(${id});renderPickingModal()">Remove</button>
      </li>`;
  }
  const img = primaryImage(item.images);
  const thumb = img
    ? `<img class="picking-row-thumb" src="${imageUrl(img.filename)}" alt="">`
    : `<div class="picking-row-thumb picking-row-thumb--empty">${TYPE_ICONS[item.type] || '📦'}</div>`;
  return `
    <li class="picking-row">
      ${thumb}
      <div class="picking-row-body">
        <div class="picking-row-asset">${item.asset_id}</div>
        <div class="picking-row-name">${escHtml(item.name)}</div>
        <div class="text-dim">
          ${escHtml(item.storage_area) || '—'}${item.storage_location ? ' · ' + escHtml(item.storage_location) : ''}
        </div>
      </div>
      <button class="btn btn-outline btn-xs" onclick="removeFromPicking(${item.id});renderPickingModal()">Remove</button>
    </li>`;
}

// ─── Print / PDF export ─────────────────────────────────────────────────────
async function printPickingList() {
  const ids = getPickingList();
  if (ids.length === 0) { toast('Picking list is empty'); return; }

  // Resolve items
  const items = (await Promise.all(ids.map(id => getItem(id).catch(() => null))))
    .filter(Boolean);

  if (items.length === 0) { toast('No items could be loaded'); return; }

  // Build a hidden print container in the current document so images
  // can use the same /uploads/ paths.
  document.getElementById('picking-print-root')?.remove();
  const root = document.createElement('div');
  root.id = 'picking-print-root';
  root.className = 'picking-print-root';
  root.innerHTML = `
    <div class="picking-print-header">
      <div class="picking-print-title">People's Theatre — Picking List</div>
      <div class="picking-print-meta">${items.length} items · ${new Date().toLocaleString('en-GB')}</div>
    </div>
    ${groupPickingByType(items.map(item => ({ id: item.id, item }))).map(g => `
      <section class="picking-print-section">
        <h2 class="picking-print-section-title">${g.label} <span class="picking-print-section-count">(${g.entries.length})</span></h2>
        <div class="picking-print-grid">
          ${g.entries.map(({ item }) => renderPrintCell(item)).join('')}
        </div>
      </section>
    `).join('')}`;
  document.body.appendChild(root);

  // Give images a moment to load before opening the print dialog.
  await waitForImages(root);
  window.print();
}

function renderPrintCell(item) {
  const img = primaryImage(item.images);
  const imgHtml = img
    ? `<img class="pp-cell-img" src="${imageUrl(img.filename)}" alt="">`
    : `<div class="pp-cell-img pp-cell-img--empty">${TYPE_ICONS[item.type] || '📦'}</div>`;
  return `
    <div class="pp-cell">
      ${imgHtml}
      <div class="pp-cell-body">
        <div class="pp-cell-asset">${item.asset_id}</div>
        <div class="pp-cell-name">${escHtml(item.name)}</div>
        <div class="pp-cell-loc"><strong>Location:</strong> ${escHtml(item.storage_area) || '—'}</div>
        <div class="pp-cell-loc"><strong>Storage:</strong> ${escHtml(item.storage_location) || '—'}</div>
      </div>
    </div>`;
}

function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'));
  return Promise.all(imgs.map(img =>
    img.complete ? Promise.resolve() :
      new Promise(res => { img.onload = img.onerror = () => res(); })
  ));
}

// Clean up the print root after the print dialog closes
window.addEventListener('afterprint', () => {
  document.getElementById('picking-print-root')?.remove();
});

document.addEventListener('DOMContentLoaded', setupPickingFab);
