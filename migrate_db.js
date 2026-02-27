const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./clients.db', (err) => {
  if (err) { console.error('DB open error:', err.message); process.exit(1); }
});

const statements = [
  "ALTER TABLE clients ADD COLUMN customerIdNo TEXT;",
  "ALTER TABLE clients ADD COLUMN vehicleNumberPlate TEXT;",
  "ALTER TABLE clients ADD COLUMN startDate DATE;",
  "ALTER TABLE clients ADD COLUMN expiryDate DATE;",
  "ALTER TABLE clients ADD COLUMN company TEXT;",
  "ALTER TABLE clients ADD COLUMN premiumPaid REAL;",
  "ALTER TABLE records ADD COLUMN recordType TEXT;",
  // Copy old values
  "UPDATE clients SET vehicleNumberPlate = policyNumber WHERE vehicleNumberPlate IS NULL OR vehicleNumberPlate = '';",
  "UPDATE clients SET customerIdNo = address WHERE customerIdNo IS NULL OR customerIdNo = '';"
];

function runNext(i) {
  if (i >= statements.length) {
    console.log('Migration complete');
    db.close();
    return;
  }
  db.run(statements[i], (err) => {
    if (err) console.error('Statement error:', statements[i], err.message);
    else console.log('Executed:', statements[i]);
    runNext(i+1);
  });
}

runNext(0);
