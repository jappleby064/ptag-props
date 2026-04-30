const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { loadDb, saveDb, nextAssetId } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Store in memory so sharp can compress before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpeg|jpg|png|gif|webp)$/i.test(file.originalname);
    cb(null, ok);
  },
});

async function compressAndSave(file) {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const dest = path.join(UPLOADS_DIR, filename);
  await sharp(file.buffer)
    .rotate()                          // auto-orient from EXIF
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toFile(dest);
  return filename;
}

function itemWithImages(item, db) {
  const images = db.images
    .filter(img => img.item_id === item.id)
    .sort((a, b) => b.is_primary - a.is_primary || a.id - b.id);
  const openReports = (db.reports || []).filter(r => r.item_id === item.id && !r.resolved);
  const flags = {
    missing: openReports.some(r => r.type === 'missing'),
    broken:  openReports.some(r => r.type === 'broken'),
  };
  return { ...item, images, flags };
}

// GET suggested next asset ID for a type (public — used by the add form)
router.get('/suggest-id/:type', (req, res) => {
  const { type } = req.params;
  if (!['prop', 'furniture', 'costume'].includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  const db = loadDb();
  const prefixes = { prop: 'P', furniture: 'F', costume: 'C' };
  const next = (db.counters[type] || 0) + 1;
  res.json({ suggestion: `${prefixes[type]}-${String(next).padStart(3, '0')}` });
});

// GET all items (public)
router.get('/', (req, res) => {
  const { type, search } = req.query;
  const db = loadDb();
  let items = db.items;

  if (type && type !== 'all') items = items.filter(i => i.type === type);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i =>
      [i.name, i.asset_id, i.storage_area, i.item_category]
        .some(v => v && v.toLowerCase().includes(q))
    );
  }

  items = [...items].sort((a, b) =>
    a.type.localeCompare(b.type) || a.asset_id.localeCompare(b.asset_id)
  );
  res.json(items.map(i => itemWithImages(i, db)));
});

// GET single item (public)
router.get('/:id', (req, res) => {
  const db = loadDb();
  const item = db.items.find(i => i.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(itemWithImages(item, db));
});

// POST create item (admin)
router.post('/', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const { type, item_category, name, asset_id: providedId,
            storage_area, storage_location, size, dimensions, notes } = req.body;

    if (!type || !item_category || !name)
      return res.status(400).json({ error: 'type, item_category, and name are required' });
    if (!['prop', 'furniture', 'costume'].includes(type))
      return res.status(400).json({ error: 'Invalid type' });

    const db = loadDb();

    let asset_id;
    if (providedId && providedId.trim()) {
      asset_id = providedId.trim().toUpperCase();
      if (db.items.find(i => i.asset_id === asset_id))
        return res.status(409).json({ error: `Asset ID ${asset_id} is already in use` });
      const prefixes = { prop: 'P', furniture: 'F', costume: 'C' };
      const match = asset_id.match(new RegExp(`^${prefixes[type]}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > db.counters[type]) db.counters[type] = num;
      }
    } else {
      asset_id = nextAssetId(type, db);
    }

    const now = new Date().toISOString();
    const id = db.nextId.item++;
    const item = {
      id, asset_id, type, item_category, name,
      storage_area:     storage_area     || null,
      storage_location: storage_location || null,
      size:             type === 'costume'  ? (size       || null) : null,
      dimensions:       type === 'furniture'? (dimensions || null) : null,
      notes:            notes  || null,
      created_at:       now,
      updated_at:       now,
    };

    db.items.push(item);

    if (req.files && req.files.length > 0) {
      const filenames = await Promise.all(req.files.map(f => compressAndSave(f)));
      filenames.forEach((filename, idx) => {
        db.images.push({
          id: db.nextId.image++,
          item_id: id,
          filename,
          original_name: req.files[idx].originalname,
          is_primary: idx === 0 ? 1 : 0,
          created_at: now,
        });
      });
    }

    saveDb(db);
    res.status(201).json(itemWithImages(item, db));
  } catch (err) {
    console.error('[POST /items]', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT update item (admin)
router.put('/:id', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const db = loadDb();
    const idx = db.items.findIndex(i => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });

    const existing = db.items[idx];
    const { item_category, name, storage_area, storage_location, size, dimensions, notes } = req.body;
    const now = new Date().toISOString();

    db.items[idx] = {
      ...existing,
      item_category:    item_category    || existing.item_category,
      name:             name             || existing.name,
      storage_area:     storage_area     !== undefined ? storage_area     : existing.storage_area,
      storage_location: storage_location !== undefined ? storage_location : existing.storage_location,
      size:             existing.type === 'costume'
                          ? (size       !== undefined ? size       : existing.size)
                          : null,
      dimensions:       existing.type === 'furniture'
                          ? (dimensions !== undefined ? dimensions : existing.dimensions)
                          : null,
      notes:            notes !== undefined ? notes : existing.notes,
      updated_at:       now,
    };

    if (req.files && req.files.length > 0) {
      const hasImages = db.images.some(img => img.item_id === existing.id);
      const filenames = await Promise.all(req.files.map(f => compressAndSave(f)));
      filenames.forEach((filename, fileIdx) => {
        db.images.push({
          id: db.nextId.image++,
          item_id: existing.id,
          filename,
          original_name: req.files[fileIdx].originalname,
          is_primary: !hasImages && fileIdx === 0 ? 1 : 0,
          created_at: now,
        });
      });
    }

    saveDb(db);
    res.json(itemWithImages(db.items[idx], db));
  } catch (err) {
    console.error('[PUT /items/:id]', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE item (admin)
router.delete('/:id', requireAuth, (req, res) => {
  const db = loadDb();
  const id = Number(req.params.id);
  const item = db.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.images
    .filter(img => img.item_id === id)
    .forEach(img => {
      const p = path.join(__dirname, '..', 'uploads', img.filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

  db.items  = db.items.filter(i => i.id !== id);
  db.images = db.images.filter(img => img.item_id !== id);
  saveDb(db);
  res.json({ success: true });
});

// DELETE single image (admin)
router.delete('/:id/images/:imageId', requireAuth, (req, res) => {
  const db = loadDb();
  const imgId  = Number(req.params.imageId);
  const itemId = Number(req.params.id);
  const img    = db.images.find(i => i.id === imgId && i.item_id === itemId);
  if (!img) return res.status(404).json({ error: 'Image not found' });

  const p = path.join(__dirname, '..', 'uploads', img.filename);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  db.images = db.images.filter(i => i.id !== imgId);

  if (img.is_primary) {
    const next = db.images.find(i => i.item_id === itemId);
    if (next) next.is_primary = 1;
  }

  saveDb(db);
  res.json({ success: true });
});

// PATCH set primary image (admin)
router.patch('/:id/images/:imageId/primary', requireAuth, (req, res) => {
  const db     = loadDb();
  const itemId = Number(req.params.id);
  const imgId  = Number(req.params.imageId);
  db.images.filter(i => i.item_id === itemId).forEach(i => { i.is_primary = 0; });
  const target = db.images.find(i => i.id === imgId && i.item_id === itemId);
  if (target) target.is_primary = 1;
  saveDb(db);
  res.json({ success: true });
});

module.exports = router;
