const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- Database Setup ---
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    priority TEXT,
    time TEXT,
    completed INTEGER DEFAULT 0,
    date TEXT,
    notified INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    date TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE,
    rate INTEGER
  )`);
});

// --- API Endpoints ---

// Tasks
app.get('/api/tasks/:date', (req, res) => {
  const { date } = req.params;
  db.all('SELECT * FROM tasks WHERE date = ?', [date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tasks', (req, res) => {
  const { title, priority, time, date } = req.body;
  db.run('INSERT INTO tasks (title, priority, time, date) VALUES (?, ?, ?, ?)', 
    [title, priority, time, date], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { completed, notified } = req.body;
  
  if (completed !== undefined) {
    db.run('UPDATE tasks SET completed = ? WHERE id = ?', [completed ? 1 : 0, id]);
  }
  if (notified !== undefined) {
    db.run('UPDATE tasks SET notified = ? WHERE id = ?', [notified ? 1 : 0, id]);
  }
  res.json({ success: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Diary
app.get('/api/diary/:date', (req, res) => {
  db.get('SELECT content FROM diary WHERE date = ?', [req.params.date], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || { content: '' });
  });
});

app.post('/api/diary', (req, res) => {
  const { content, date } = req.body;
  db.run('INSERT OR REPLACE INTO diary (content, date) VALUES (?, ?)', [content, date], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// History / Analytics
app.get('/api/history', (req, res) => {
  db.all('SELECT date, rate FROM history', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const history = {};
    rows.forEach(r => history[r.date] = r.rate);
    res.json(history);
  });
});

app.post('/api/history', (req, res) => {
  const { date, rate } = req.body;
  db.run('INSERT OR REPLACE INTO history (date, rate) VALUES (?, ?)', [date, rate], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
