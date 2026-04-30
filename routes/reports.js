const express = require('express');
const { loadDb, saveDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST submit a report (public — anyone can report)
router.post('/', (req, res) => {
  const { item_id, type, note } = req.body;
  if (!item_id || !type) return res.status(400).json({ error: 'item_id and type required' });
  if (!['missing', 'broken'].includes(type)) return res.status(400).json({ error: 'type must be missing or broken' });

  const db = loadDb();
  const item = db.items.find(i => i.id === Number(item_id));
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const report = {
    id:           db.nextId.report++,
    item_id:      item.id,
    item_name:    item.name,
    item_asset_id: item.asset_id,
    item_type:    item.type,
    type,
    note:         note ? note.trim() : null,
    reported_at:  new Date().toISOString(),
    resolved:     false,
    resolved_at:  null,
    resolved_by:  null,
    resolve_note: null,
  };

  db.reports.push(report);
  saveDb(db);
  res.status(201).json(report);
});

// GET all reports (admin only)
router.get('/', requireAuth, (req, res) => {
  const db = loadDb();
  const { status } = req.query; // 'open' | 'resolved' | 'all'
  let reports = [...db.reports].sort(
    (a, b) => new Date(b.reported_at) - new Date(a.reported_at)
  );
  if (status === 'open')     reports = reports.filter(r => !r.resolved);
  if (status === 'resolved') reports = reports.filter(r => r.resolved);
  res.json(reports);
});

// PATCH resolve a report (admin)
router.patch('/:id/resolve', requireAuth, (req, res) => {
  const db = loadDb();
  const report = db.reports.find(r => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });

  report.resolved     = true;
  report.resolved_at  = new Date().toISOString();
  report.resolved_by  = req.admin.username;
  report.resolve_note = req.body.resolve_note ? req.body.resolve_note.trim() : null;
  saveDb(db);
  res.json(report);
});

// DELETE a report (admin)
router.delete('/:id', requireAuth, (req, res) => {
  const db = loadDb();
  const idx = db.reports.findIndex(r => r.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Report not found' });
  db.reports.splice(idx, 1);
  saveDb(db);
  res.json({ success: true });
});

module.exports = router;
