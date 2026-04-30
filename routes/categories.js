const express = require('express');
const { loadDb, saveDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const VALID_TYPES = ['prop', 'furniture', 'costume'];

// GET all categories (public)
router.get('/', (req, res) => {
  const db = loadDb();
  res.json(db.categories);
});

// POST add a category to a type (admin)
router.post('/:type', requireAuth, (req, res) => {
  const { type } = req.params;
  const { name } = req.body;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Category name required' });

  const db = loadDb();
  const trimmed = name.trim();
  if (db.categories[type].includes(trimmed))
    return res.status(409).json({ error: 'Category already exists' });

  db.categories[type].push(trimmed);
  saveDb(db);
  res.status(201).json(db.categories);
});

// DELETE a category from a type (admin)
router.delete('/:type/:name', requireAuth, (req, res) => {
  const { type } = req.params;
  const name = decodeURIComponent(req.params.name);
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

  const db = loadDb();
  const idx = db.categories[type].indexOf(name);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });

  db.categories[type].splice(idx, 1);
  saveDb(db);
  res.json(db.categories);
});

// PUT rename a category (admin) — also updates all items using it
router.put('/:type/:name', requireAuth, (req, res) => {
  const { type } = req.params;
  const oldName = decodeURIComponent(req.params.name);
  const { name: newName } = req.body;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (!newName || !newName.trim()) return res.status(400).json({ error: 'New name required' });

  const db = loadDb();
  const idx = db.categories[type].indexOf(oldName);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });

  const trimmed = newName.trim();
  db.categories[type][idx] = trimmed;
  db.items
    .filter(i => i.type === type && i.item_category === oldName)
    .forEach(i => { i.item_category = trimmed; });
  saveDb(db);
  res.json(db.categories);
});

module.exports = router;
