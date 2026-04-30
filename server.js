require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/items',      require('./routes/items'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/storage',    require('./routes/storage'));
app.use('/api/reports',    require('./routes/reports'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDatabase();
app.listen(PORT, () =>
  console.log(`People's Theatre Inventory running at http://localhost:${PORT}`)
);
