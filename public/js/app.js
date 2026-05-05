// Main browse page — item grid, detail view, add/edit form

const IS_ADMIN = !!getToken();
let currentFilter = { type: 'all', search: '' };
let debounceTimer;

document.addEventListener('DOMContentLoaded', async () => {
  // Load dynamic data in parallel
  const [cats, areas] = await Promise.all([
    getCategories().catch(() => null),
    getStorageAreas().catch(() => []),
  ]);
  if (cats) window.APP_STATE.categories = cats;
  window.APP_STATE.storageAreas = areas;

  setupHeader();
  setupFilters();
  loadItems();

  // Poll for open report count every 30s when admin
  if (IS_ADMIN) {
    refreshReportBadge();
    setInterval(refreshReportBadge, 30000);
  }
});

// ── Header ────────────────────────────────────────────────────────────────────
function setupHeader() {
  const slot = document.getElementById('header-actions');
  if (IS_ADMIN) {
    const user = localStorage.getItem('ptag_user') || 'Admin';
    slot.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="openAddModal()">+ Add Item</button>
      <button class="btn btn-outline btn-sm" id="dashboard-btn" onclick="openDashboard()">📋 Dashboard <span id="report-badge" class="report-badge hidden">0</span></button>
      <button class="btn btn-outline btn-sm" onclick="openSettings()">⚙️ Settings</button>
      <span class="header-user">👤 ${escHtml(user)}</span>
      <button class="btn btn-outline btn-sm" onclick="doLogout()">Sign out</button>`;
  } else {
    slot.innerHTML = `<a href="/login.html" class="btn btn-copper btn-sm">Admin Login</a>`;
  }
}

async function doLogout() {
  await logout();
  localStorage.removeItem('ptag_token');
  localStorage.removeItem('ptag_user');
  window.location.reload();
}

async function refreshReportBadge() {
  try {
    const reports = await getReports('open');
    const badge = document.getElementById('report-badge');
    if (!badge) return;
    if (reports.length > 0) {
      badge.textContent = reports.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch {}
}

// ── Filters ───────────────────────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter.type = tab.dataset.type;
      loadItems();
    });
  });

  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentFilter.search = e.target.value.trim();
      loadItems();
    }, 300);
  });
}

// ── Grid ──────────────────────────────────────────────────────────────────────
async function loadItems() {
  const grid = document.getElementById('item-grid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading inventory…</div>';
  try {
    const items = await getItems(currentFilter);
    document.getElementById('result-count').textContent =
      `${items.length} item${items.length !== 1 ? 's' : ''}`;

    if (items.length === 0) {
      grid.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div>
        <h3>No items found</h3><p>Try adjusting your search or filters.</p></div>`;
      return;
    }
    grid.innerHTML = items.map(i => renderCard(i, IS_ADMIN)).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
      <h3>Failed to load</h3><p>${escHtml(err.message)}</p></div>`;
  }
}

// ── Detail modal ───────────────────────────────────────────────────────────────
async function openDetailModal(id) {
  try { showDetailModal(await getItem(id)); }
  catch (err) { toast(err.message, true); }
}

function showDetailModal(item) {
  document.getElementById('detail-modal-backdrop')?.remove();

  const sizeRow = item.type === 'costume' && item.size ? `
    <div class="detail-field">
      <label>Size</label>
      <div class="value">${escHtml(item.size)}</div>
    </div>` : '';

  const dimensionsRow = item.type === 'furniture' && item.dimensions ? `
    <div class="detail-field">
      <label>Dimensions</label>
      <div class="value">${escHtml(item.dimensions)}</div>
    </div>` : '';

  const galleryHtml = item.images && item.images.length > 0
    ? item.images.map((img, idx) => `
        <div class="gallery-item${img.is_primary ? ' primary' : ''}">
          ${img.is_primary ? '<div class="gallery-primary-badge">★ Primary</div>' : ''}
          <img src="${imageUrl(img.filename)}" alt=""
               onclick="openLightbox(${JSON.stringify(item.images).replace(/"/g,'&quot;')},${idx})">
          ${IS_ADMIN ? `<div class="gallery-item-actions">
            ${!img.is_primary ? `<button class="btn btn-sm btn-outline" onclick="setImgPrimary(${item.id},${img.id})">★</button>` : ''}
            <button class="btn btn-sm btn-danger" onclick="removeImg(${item.id},${img.id})">🗑️</button>
          </div>` : ''}
        </div>`).join('')
    : `<div class="no-image-placeholder"><span>📷</span>No images uploaded</div>`;

  const adminButtons = IS_ADMIN ? `
    <button class="btn btn-copper" onclick="openEditModal(${item.id});closeModal('detail-modal-backdrop')">✏️ Edit</button>
    <button class="btn btn-danger" onclick="confirmDelete(${item.id},'${escHtml(item.name)}');closeModal('detail-modal-backdrop')">🗑️ Delete</button>` : '';

  const el = document.createElement('div');
  el.id = 'detail-modal-backdrop';
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div>
          <div class="modal-asset-id">${item.asset_id}</div>
          <div class="modal-title">${escHtml(item.name)}</div>
        </div>
        <div class="card-meta" style="flex:1;margin-left:12px">${typeChip(item.type)} ${categoryChip(item.item_category)}</div>
        <button class="modal-close" onclick="closeModal('detail-modal-backdrop')">×</button>
      </div>
      <div class="modal-body">
        <div class="gallery">${galleryHtml}</div>
        <div class="section-divider"></div>
        <div class="detail-grid">
          <div class="detail-field">
            <label>Storage Area</label>
            <div class="value">${escHtml(item.storage_area) || '—'}</div>
          </div>
          <div class="detail-field">
            <label>Storage Location</label>
            <div class="value">${escHtml(item.storage_location) || '—'}</div>
          </div>
          ${sizeRow}
          ${dimensionsRow}
          <div class="detail-field full">
            <label>Notes</label>
            <div class="value" style="white-space:pre-wrap">${escHtml(item.notes) || '—'}</div>
          </div>
        </div>
        <div class="form-actions" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-copper" onclick="addToPicking(${item.id},'${escHtml(item.name)}')">📋 Add to Picking List</button>
            <button class="btn btn-report-detail" onclick="openReportModal(${item.id},'${escHtml(item.name)}','missing')">🔍 Report Missing</button>
            <button class="btn btn-report-detail btn-report-detail--broken" onclick="openReportModal(${item.id},'${escHtml(item.name)}','broken')">🔧 Report Broken</button>
          </div>
          ${IS_ADMIN ? `<div style="display:flex;gap:8px">${adminButtons}</div>` : ''}
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
}

// ── Image actions ──────────────────────────────────────────────────────────────
async function setImgPrimary(itemId, imageId) {
  try {
    await setPrimaryImage(itemId, imageId);
    showDetailModal(await getItem(itemId));
    toast('Primary image updated');
  } catch (err) { toast(err.message, true); }
}
async function removeImg(itemId, imageId) {
  if (!confirm('Delete this image?')) return;
  try {
    await deleteImage(itemId, imageId);
    showDetailModal(await getItem(itemId));
    toast('Image removed');
  } catch (err) { toast(err.message, true); }
}

function renderFormGallery(item) {
  if (!item.images || item.images.length === 0)
    return `<div class="no-image-placeholder"><span>📷</span>No images uploaded</div>`;
  return item.images.map((img, idx) => `
    <div class="gallery-item${img.is_primary ? ' primary' : ''}">
      ${img.is_primary ? '<div class="gallery-primary-badge">★ Primary</div>' : ''}
      <img src="${imageUrl(img.filename)}" alt=""
           onclick="openLightbox(${JSON.stringify(item.images).replace(/"/g,'&quot;')},${idx})">
      <div class="gallery-item-actions">
        ${!img.is_primary ? `<button type="button" class="btn btn-sm btn-outline" onclick="setImgPrimaryInForm(${item.id},${img.id})">★</button>` : ''}
        <button type="button" class="btn btn-sm btn-danger" onclick="removeImgInForm(${item.id},${img.id})">🗑️</button>
      </div>
    </div>`).join('');
}

async function refreshFormGallery(itemId) {
  const gallery = document.getElementById('form-existing-gallery');
  if (!gallery) return;
  const item = await getItem(itemId);
  gallery.innerHTML = renderFormGallery(item);
}

async function setImgPrimaryInForm(itemId, imageId) {
  try {
    await setPrimaryImage(itemId, imageId);
    await refreshFormGallery(itemId);
    toast('Primary image updated');
  } catch (err) { toast(err.message, true); }
}

async function removeImgInForm(itemId, imageId) {
  if (!confirm('Delete this image?')) return;
  try {
    await deleteImage(itemId, imageId);
    await refreshFormGallery(itemId);
    toast('Image removed');
  } catch (err) { toast(err.message, true); }
}

// ── Add / Edit modal ───────────────────────────────────────────────────────────
function openAddModal() { showItemForm(null); }
async function openEditModal(id) {
  try { showItemForm(await getItem(id)); }
  catch (err) { toast(err.message, true); }
}

async function showItemForm(item = null) {
  document.getElementById('form-modal-backdrop')?.remove();
  const isEdit = !!item;
  const defaultType = item ? item.type : 'prop';
  const catOptions = buildCategoryOptions(defaultType, item ? item.item_category : '');
  const areaOptions = buildStorageOptions(item ? item.storage_area : '');

  // Fetch suggested ID for new items
  let suggestedId = '';
  if (!isEdit) {
    try { suggestedId = (await suggestId(defaultType)).suggestion; } catch {}
  }

  const el = document.createElement('div');
  el.id = 'form-modal-backdrop';
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? `Edit: ${escHtml(item.name)}` : 'Add New Item'}</div>
        <button class="modal-close" onclick="closeModal('form-modal-backdrop')">×</button>
      </div>
      <div class="modal-body">
        <form id="item-form" onsubmit="submitItemForm(event,${isEdit ? item.id : 'null'})">
          <div class="form-grid">
            <div class="form-field">
              <label>Type <span class="required">*</span></label>
              <select name="type" id="form-type" onchange="onTypeChange()" ${isEdit ? 'disabled' : ''} required>
                <option value="prop"      ${defaultType==='prop'      ?'selected':''}>Prop</option>
                <option value="furniture" ${defaultType==='furniture' ?'selected':''}>Furniture</option>
                <option value="costume"   ${defaultType==='costume'   ?'selected':''}>Costume</option>
              </select>
            </div>
            <div class="form-field">
              <label>Category <span class="required">*</span></label>
              <select name="item_category" id="form-category" required>${catOptions}</select>
            </div>
            <div class="form-field">
              <label>Asset ID ${isEdit ? '' : '<span class="required">*</span>'}</label>
              <input type="text" name="asset_id" id="form-asset-id"
                     value="${isEdit ? escHtml(item.asset_id) : escHtml(suggestedId)}"
                     placeholder="e.g. P-001"
                     ${isEdit ? 'disabled' : 'required'}
                     style="text-transform:uppercase"
                     oninput="this.value=this.value.toUpperCase()">
              ${!isEdit ? '<span class="hint">Suggested — change if needed</span>' : ''}
            </div>
            <div class="form-field">
              <label>Name <span class="required">*</span></label>
              <input type="text" name="name" value="${escHtml(item ? item.name : '')}" placeholder="Item name" required>
            </div>
            <div class="form-field">
              <label>Storage Area</label>
              <select name="storage_area" id="form-storage-area">${areaOptions}</select>
            </div>
            <div class="form-field">
              <label>Storage Location</label>
              <input type="text" name="storage_location" value="${escHtml(item ? item.storage_location : '')}" placeholder="e.g. Shelf 3, Box 2">
            </div>
            <div class="form-field" id="size-field" style="${defaultType==='costume'?'':'display:none'}">
              <label>Size</label>
              <input type="text" name="size" value="${escHtml(item ? item.size : '')}" placeholder="e.g. M, 10, 34W">
            </div>
            <div class="form-field" id="dimensions-field" style="${defaultType==='furniture'?'':'display:none'}">
              <label>Dimensions</label>
              <input type="text" name="dimensions" value="${escHtml(item ? item.dimensions : '')}" placeholder="e.g. 120×60×75 cm">
            </div>
            <div class="form-field full">
              <label>Notes</label>
              <textarea name="notes" placeholder="Any additional notes…">${escHtml(item ? item.notes : '')}</textarea>
            </div>
            ${isEdit ? `
            <div class="form-field full">
              <label>Existing Images</label>
              <div class="gallery" id="form-existing-gallery">${renderFormGallery(item)}</div>
            </div>` : ''}
            <div class="form-field full">
              <label>${isEdit ? 'Add More Images' : 'Images'}</label>
              <div class="upload-zone" onclick="document.getElementById('file-input').click()"
                   ondragover="event.preventDefault();this.classList.add('drag')"
                   ondragleave="this.classList.remove('drag')"
                   ondrop="handleDrop(event)">
                <span class="upload-zone-icon">📷</span>
                Click or drag images here (JPEG, PNG · max 10 MB each)
                <input type="file" id="file-input" accept="image/*" multiple onchange="handleFiles(this.files)">
              </div>
              <div class="upload-preview" id="upload-preview"></div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline" onclick="closeModal('form-modal-backdrop')">Cancel</button>
            <button type="submit" class="btn btn-copper" id="submit-btn">${isEdit ? '💾 Save Changes' : '➕ Add Item'}</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('item-form')._files = [];
}

async function onTypeChange() {
  const type = document.getElementById('form-type').value;
  document.getElementById('form-category').innerHTML = buildCategoryOptions(type);
  document.getElementById('size-field').style.display       = type === 'costume'   ? '' : 'none';
  document.getElementById('dimensions-field').style.display = type === 'furniture' ? '' : 'none';
  // Refresh suggested ID
  try {
    const { suggestion } = await suggestId(type);
    document.getElementById('form-asset-id').value = suggestion;
  } catch {}
}

function handleFiles(fileList) {
  const form = document.getElementById('item-form');
  if (!form) return;
  form._files = form._files || [];
  Array.from(fileList).forEach(f => form._files.push(f));
  renderUploadPreview();
}
function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag');
  handleFiles(e.dataTransfer.files);
}
function renderUploadPreview() {
  const form    = document.getElementById('item-form');
  const preview = document.getElementById('upload-preview');
  if (!preview || !form) return;
  preview.innerHTML = (form._files || []).map((f, i) =>
    `<div class="upload-thumb">
       <img src="${URL.createObjectURL(f)}">
       <button type="button" class="upload-thumb-remove" onclick="removeUploadFile(${i})">×</button>
     </div>`).join('');
}
function removeUploadFile(idx) {
  const form = document.getElementById('item-form');
  form._files.splice(idx, 1);
  renderUploadPreview();
}

async function submitItemForm(e, id) {
  e.preventDefault();
  const form = e.target;
  const btn  = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  const data = new FormData();
  ['type','item_category','name','asset_id','storage_area','storage_location','size','dimensions','notes']
    .forEach(f => { const el = form.elements[f]; if (el && !el.disabled) data.append(f, el.value); });
  (form._files || []).forEach(file => data.append('images', file));

  try {
    if (id) { await updateItem(id, data); toast('Item updated'); }
    else     { await createItem(data);    toast('Item added'); }
    closeModal('form-modal-backdrop');
    loadItems();
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false;
    btn.innerHTML = id ? '💾 Save Changes' : '➕ Add Item';
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
function confirmDelete(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  deleteItem(id)
    .then(() => { toast(`"${name}" deleted`); loadItems(); })
    .catch(err => toast(err.message, true));
}
