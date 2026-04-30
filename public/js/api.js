function getToken() { return localStorage.getItem('ptag_token'); }

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  if (res.status === 401) {
    localStorage.removeItem('ptag_token');
    localStorage.removeItem('ptag_user');
    if (!window.location.pathname.includes('login')) window.location.href = '/login.html';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Items ────────────────────────────────────────────────────────────────────
async function getItems(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== 'all'))
  ).toString();
  return apiFetch(`/items${qs ? '?' + qs : ''}`);
}
async function getItem(id)                { return apiFetch(`/items/${id}`); }
async function suggestId(type)            { return apiFetch(`/items/suggest-id/${type}`); }
async function createItem(formData)       { return apiFetch('/items', { method: 'POST', headers: authHeaders(), body: formData }); }
async function updateItem(id, formData)   { return apiFetch(`/items/${id}`, { method: 'PUT', headers: authHeaders(), body: formData }); }
async function deleteItem(id)             { return apiFetch(`/items/${id}`, { method: 'DELETE', headers: authHeaders({ 'Content-Type': 'application/json' }) }); }
async function deleteImage(iid, imgId)    { return apiFetch(`/items/${iid}/images/${imgId}`, { method: 'DELETE', headers: authHeaders({ 'Content-Type': 'application/json' }) }); }
async function setPrimaryImage(iid, imgId){ return apiFetch(`/items/${iid}/images/${imgId}/primary`, { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }) }); }

// ── Auth ─────────────────────────────────────────────────────────────────────
async function login(username, password) {
  return apiFetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
}

// ── Categories ───────────────────────────────────────────────────────────────
async function getCategories()                           { return apiFetch('/categories'); }
async function addCategory(type, name)                   { return apiFetch(`/categories/${type}`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name }) }); }
async function deleteCategory(type, name)                { return apiFetch(`/categories/${type}/${encodeURIComponent(name)}`, { method: 'DELETE', headers: authHeaders({ 'Content-Type': 'application/json' }) }); }
async function renameCategory(type, oldName, newName)    { return apiFetch(`/categories/${type}/${encodeURIComponent(oldName)}`, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: newName }) }); }

// ── Storage Areas ─────────────────────────────────────────────────────────────
async function getStorageAreas()               { return apiFetch('/storage'); }
async function addStorageArea(name)            { return apiFetch('/storage', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name }) }); }
async function deleteStorageArea(name)         { return apiFetch(`/storage/${encodeURIComponent(name)}`, { method: 'DELETE', headers: authHeaders({ 'Content-Type': 'application/json' }) }); }
async function renameStorageArea(old, nw)      { return apiFetch(`/storage/${encodeURIComponent(old)}`, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: nw }) }); }

// ── Reports ──────────────────────────────────────────────────────────────────
async function submitReport(item_id, type, note) { return apiFetch('/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id, type, note }) }); }
async function getReports(status = 'open')       { return apiFetch(`/reports?status=${status}`, { headers: authHeaders() }); }
async function resolveReport(id, resolve_note)   { return apiFetch(`/reports/${id}/resolve`, { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ resolve_note }) }); }
async function deleteReport(id)                  { return apiFetch(`/reports/${id}`, { method: 'DELETE', headers: authHeaders({ 'Content-Type': 'application/json' }) }); }
