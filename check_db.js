const { Client } = require('pg');

const client = new Client({
  user: 'your_username',
  host: 'localhost',
  database: 'your_database',
  password: 'your_password',
  port: 5432, // default PostgreSQL port
});

(async () => {
  try {
    await client.connect();

    // Get table info similar to PRAGMA table_info in SQLite
    const tableName = 'clients';
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1;
    `, [tableName]);

    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('DB error:', err.message);
  } finally {
    await client.end();
  }
})();