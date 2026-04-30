const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { schedulePublish } = require('./publish');

const DB_FILE = path.join(__dirname, 'inventory.json');

const EMPTY_DB = {
  admins:        [],
  items:         [],
  images:        [],
  categories:    {
    prop:      ['Prop Type 1', 'Prop Type 2', 'Prop Type 3'],
    furniture: ['Furniture Type 1', 'Furniture Type 2', 'Furniture Type 3'],
    costume:   ['Costume Type 1', 'Costume Type 2', 'Costume Type 3'],
  },
  storage_areas: [],
  reports:       [],
  counters:      { prop: 0, furniture: 0, costume: 0 },
  nextId:        { admin: 1, item: 1, image: 1, report: 1 },
};

function loadDb() {
  if (!fs.existsSync(DB_FILE)) return JSON.parse(JSON.stringify(EMPTY_DB));
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // Migrate older DBs that are missing new fields
    if (!db.categories)    db.categories    = EMPTY_DB.categories;
    if (!db.storage_areas) db.storage_areas = [];
    if (!db.reports)       db.reports       = [];
    if (!db.nextId.report) db.nextId.report = 1;
    return db;
  } catch {
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  schedulePublish();
}

function initDatabase() {
  const db = loadDb();

  if (!db.admins.find(a => a.username === 'wardrobe')) {
    const hash = bcrypt.hashSync('PtaG2026', 10);
    db.admins.push({ id: db.nextId.admin++, username: 'wardrobe', password_hash: hash });
    saveDb(db);
    console.log('Default admin user created.');
  }

  console.log('Database ready:', DB_FILE);
}

function nextAssetId(type, db) {
  const prefixes = { prop: 'P', furniture: 'F', costume: 'C' };
  db.counters[type] = (db.counters[type] || 0) + 1;
  return `${prefixes[type]}-${String(db.counters[type]).padStart(3, '0')}`;
}

module.exports = { loadDb, saveDb, initDatabase, nextAssetId };
