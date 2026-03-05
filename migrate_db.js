const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const statements = [
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS customerIdNo TEXT`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS vehicleNumberPlate TEXT`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS startDate DATE`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS expiryDate DATE`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS company TEXT`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS premiumPaid REAL`,
  `ALTER TABLE records ADD COLUMN IF NOT EXISTS recordType TEXT`,

  `UPDATE clients SET vehicleNumberPlate = policyNumber WHERE vehicleNumberPlate IS NULL OR vehicleNumberPlate = ''`,
  `UPDATE clients SET customerIdNo = address WHERE customerIdNo IS NULL OR customerIdNo = ''`
];

async function runMigration() {
  try {
    for (const sql of statements) {
      try {
        await pool.query(sql);
        console.log("Executed:", sql);
      } catch (err) {
        console.error("Statement error:", sql, err.message);
      }
    }

    console.log("Migration complete");
    process.exit();

  } catch (err) {
    console.error("Migration failed:", err);
  }
}

runMigration();