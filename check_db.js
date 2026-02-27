const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./clients.db', (err) => {
  if (err) { console.error('DB open error:', err.message); process.exit(1); }
});

db.all("PRAGMA table_info(clients);", [], (err, rows) => {
  if (err) { console.error('PRAGMA error:', err.message); process.exit(1); }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});