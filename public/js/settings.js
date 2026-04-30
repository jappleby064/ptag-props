// Admin settings — categories & storage areas

async function openSettings() {
  document.getElementById('settings-modal-backdrop')?.remove();
  const el = document.createElement('div');
  el.id = 'settings-modal-backdrop';
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-header">
        <div class="modal-title">⚙️ Settings</div>
        <button class="modal-close" onclick="closeModal('settings-modal-backdrop')">×</button>
      </div>
      <div class="modal-body">
        <div class="dash-tabs">
          <button class="dash-tab active" onclick="loadSettingsTab('categories',this)">Categories</button>
          <button class="dash-tab" onclick="loadSettingsTab('storage',this)">Storage Areas</button>
        </div>
        <div id="settings-content" class="dash-content"></div>
      </div>
    </div>`;
  document.body.appendChild(el);
  loadSettingsTab('categories');
}

async function loadSettingsTab(tab, tabEl) {
  document.querySelectorAll('#settings-modal-backdrop .dash-tab')
    .forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');

  const content = document.getElementById('settings-content');
  if (!content) return;
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  if (tab === 'categories') await renderCategoriesTab(content);
  else                       await renderStorageTab(content);
}

// ── Categories tab ─────────────────────────────────────────────────────────────
async function renderCategoriesTab(content) {
  try {
    const cats = await getCategories();
    window.APP_STATE.categories = cats;
    const types = [
      { key: 'prop',      label: '🎭 Props' },
      { key: 'furniture', label: '🪑 Furniture' },
      { key: 'costume',   label: '👗 Costumes' },
    ];
    content.innerHTML = types.map(({ key, label }) => `
      <div class="settings-section">
        <h3 class="settings-section-title">${label}</h3>
        <div class="settings-list" id="cat-list-${key}">
          ${(cats[key] || []).map(name => renderCatRow(key, name)).join('') || '<p class="text-dim">No categories yet.</p>'}
        </div>
        <div class="settings-add-row">
          <input type="text" id="cat-input-${key}" placeholder="New category name…" class="settings-input"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();addCat('${key}');}">
          <button class="btn btn-copper btn-sm" onclick="addCat('${key}')">+ Add</button>
        </div>
      </div>`).join('<div class="section-divider"></div>');
  } catch (err) {
    content.innerHTML = `<p class="text-dim">${escHtml(err.message)}</p>`;
  }
}

function renderCatRow(type, name) {
  return `
    <div class="settings-row" id="cat-row-${type}-${escId(name)}">
      <span class="settings-row-label">${escHtml(name)}</span>
      <div class="settings-row-actions">
        <button class="btn btn-xs btn-outline" onclick="startRenameCat('${type}','${escHtml(name)}')">✏️</button>
        <button class="btn btn-xs btn-danger"  onclick="deleteCat('${type}','${escHtml(name)}')">🗑️</button>
      </div>
    </div>`;
}

async function addCat(type) {
  const input = document.getElementById(`cat-input-${type}`);
  const name  = input.value.trim();
  if (!name) return;
  try {
    const cats = await addCategory(type, name);
    window.APP_STATE.categories = cats;
    input.value = '';
    await renderCategoriesTab(document.getElementById('settings-content'));
    toast(`Category "${name}" added`);
  } catch (err) { toast(err.message, true); }
}

async function deleteCat(type, name) {
  if (!confirm(`Delete category "${name}"?`)) return;
  try {
    const cats = await deleteCategory(type, name);
    window.APP_STATE.categories = cats;
    document.getElementById(`cat-row-${type}-${escId(name)}`)?.remove();
    toast(`Category deleted`);
  } catch (err) { toast(err.message, true); }
}

function startRenameCat(type, name) {
  const rowId = `cat-row-${type}-${escId(name)}`;
  const row   = document.getElementById(rowId);
  if (!row) return;
  row.innerHTML = `
    <input type="text" value="${escHtml(name)}" class="settings-input" id="rename-input-${escId(name)}"
           style="flex:1" onkeydown="if(event.key==='Enter'){commitRenameCat('${type}','${escHtml(name)}');}">
    <div class="settings-row-actions">
      <button class="btn btn-xs btn-copper"  onclick="commitRenameCat('${type}','${escHtml(name)}')">Save</button>
      <button class="btn btn-xs btn-outline" onclick="renderCategoriesTab(document.getElementById('settings-content'))">Cancel</button>
    </div>`;
  document.getElementById(`rename-input-${escId(name)}`)?.focus();
}

async function commitRenameCat(type, oldName) {
  const input = document.getElementById(`rename-input-${escId(oldName)}`);
  const newName = input?.value.trim();
  if (!newName || newName === oldName) {
    await renderCategoriesTab(document.getElementById('settings-content'));
    return;
  }
  try {
    const cats = await renameCategory(type, oldName, newName);
    window.APP_STATE.categories = cats;
    await renderCategoriesTab(document.getElementById('settings-content'));
    toast(`Renamed to "${newName}"`);
  } catch (err) { toast(err.message, true); }
}

// ── Storage tab ────────────────────────────────────────────────────────────────
async function renderStorageTab(content) {
  try {
    const areas = await getStorageAreas();
    window.APP_STATE.storageAreas = areas;
    content.innerHTML = `
      <div class="settings-section">
        <h3 class="settings-section-title">📍 Storage Areas</h3>
        <p class="text-dim" style="margin-bottom:12px">These appear as a dropdown when adding or editing items.</p>
        <div class="settings-list" id="storage-list">
          ${areas.map(a => renderStorageRow(a)).join('') || '<p class="text-dim">No storage areas defined yet.</p>'}
        </div>
        <div class="settings-add-row">
          <input type="text" id="storage-input" placeholder="New storage area…" class="settings-input"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();addArea();}">
          <button class="btn btn-copper btn-sm" onclick="addArea()">+ Add</button>
        </div>
      </div>`;
  } catch (err) {
    content.innerHTML = `<p class="text-dim">${escHtml(err.message)}</p>`;
  }
}

function renderStorageRow(name) {
  return `
    <div class="settings-row" id="area-row-${escId(name)}">
      <span class="settings-row-label">${escHtml(name)}</span>
      <div class="settings-row-actions">
        <button class="btn btn-xs btn-outline" onclick="startRenameArea('${escHtml(name)}')">✏️</button>
        <button class="btn btn-xs btn-danger"  onclick="deleteArea('${escHtml(name)}')">🗑️</button>
      </div>
    </div>`;
}

async function addArea() {
  const input = document.getElementById('storage-input');
  const name  = input.value.trim();
  if (!name) return;
  try {
    const areas = await addStorageArea(name);
    window.APP_STATE.storageAreas = areas;
    input.value = '';
    await renderStorageTab(document.getElementById('settings-content'));
    toast(`Storage area "${name}" added`);
  } catch (err) { toast(err.message, true); }
}

async function deleteArea(name) {
  if (!confirm(`Delete storage area "${name}"?`)) return;
  try {
    const areas = await deleteStorageArea(name);
    window.APP_STATE.storageAreas = areas;
    document.getElementById(`area-row-${escId(name)}`)?.remove();
    toast('Storage area deleted');
  } catch (err) { toast(err.message, true); }
}

function startRenameArea(name) {
  const row = document.getElementById(`area-row-${escId(name)}`);
  if (!row) return;
  row.innerHTML = `
    <input type="text" value="${escHtml(name)}" class="settings-input" id="rename-area-${escId(name)}"
           style="flex:1" onkeydown="if(event.key==='Enter'){commitRenameArea('${escHtml(name)}');}">
    <div class="settings-row-actions">
      <button class="btn btn-xs btn-copper"  onclick="commitRenameArea('${escHtml(name)}')">Save</button>
      <button class="btn btn-xs btn-outline" onclick="renderStorageTab(document.getElementById('settings-content'))">Cancel</button>
    </div>`;
  document.getElementById(`rename-area-${escId(name)}`)?.focus();
}

async function commitRenameArea(oldName) {
  const input   = document.getElementById(`rename-area-${escId(oldName)}`);
  const newName = input?.value.trim();
  if (!newName || newName === oldName) {
    await renderStorageTab(document.getElementById('settings-content'));
    return;
  }
  try {
    const areas = await renameStorageArea(oldName, newName);
    window.APP_STATE.storageAreas = areas;
    await renderStorageTab(document.getElementById('settings-content'));
    toast(`Renamed to "${newName}"`);
  } catch (err) { toast(err.message, true); }
}

// Safe DOM ID from arbitrary string
function escId(str) {
  return String(str).replace(/[^a-zA-Z0-9]/g, '_');
}
