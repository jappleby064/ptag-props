const jwt = require('jsonwebtoken');
const { loadDb } = require('../database');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Reject if another login has started a newer session
  const db = loadDb();
  const admin = db.admins.find(a => a.id === payload.id);
  if (!admin || admin.session_token !== payload.session_token) {
    return res.status(401).json({ error: 'Session superseded' });
  }

  req.admin = payload;
  next();
}

module.exports = { requireAuth };
