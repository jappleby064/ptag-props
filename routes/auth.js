const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { loadDb, saveDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const db = loadDb();
  const admin = db.admins.find(a => a.username === username.toLowerCase());

  if (!admin || !bcrypt.compareSync(password, admin.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });

  // Overwrite any existing session — only one active session per user
  admin.session_token = crypto.randomBytes(32).toString('hex');
  saveDb(db);

  const token = jwt.sign(
    { id: admin.id, username: admin.username, session_token: admin.session_token },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, username: admin.username });
});

router.post('/logout', requireAuth, (req, res) => {
  const db = loadDb();
  const admin = db.admins.find(a => a.id === req.admin.id);
  if (admin) {
    admin.session_token = null;
    saveDb(db);
  }
  res.json({ ok: true });
});

module.exports = router;
