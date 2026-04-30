const express = require('express');
const { loadDb, saveDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET all storage areas (public — needed for report form)
router.get('/', (req, res) => {
  const db = loadDb();
  res.json(db.storage_areas);
});

// POST add storage area (admin)
router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

  const db = loadDb();
  const trimmed = name.trim();
  if (db.storage_areas.includes(trimmed))
    return res.status(409).json({ error: 'Storage area already exists' });

  db.storage_areas.push(trimmed);
  db.storage_areas.sort();
  saveDb(db);
  res.status(201).json(db.storage_areas);
});

// DELETE storage area (admin)
router.delete('/:name', requireAuth, (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const db = loadDb();
  const idx = db.storage_areas.indexOf(name);
  if (idx === -1) return res.status(404).json({ error: 'Storage area not found' });

  db.storage_areas.splice(idx, 1);
  saveDb(db);
  res.json(db.storage_areas);
});

// PUT rename storage area (admin) — updates all items using it
router.put('/:name', requireAuth, (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const { name: newName } = req.body;
  if (!newName || !newName.trim()) return res.status(400).json({ error: 'New name required' });

  const db = loadDb();
  const idx = db.storage_areas.indexOf(oldName);
  if (idx === -1) return res.status(404).json({ error: 'Storage area not found' });

  const trimmed = newName.trim();
  db.storage_areas[idx] = trimmed;
  db.storage_areas.sort();
  db.items
    .filter(i => i.storage_area === oldName)
    .forEach(i => { i.storage_area = trimmed; });
  saveDb(db);
  res.json(db.storage_areas);
});

module.exports = router;
