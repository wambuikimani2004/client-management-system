const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Serve static files from build folder if it exists (production)
const buildPath = path.join(__dirname, 'client/build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
}

// Admin credentials
const ADMIN_USERNAME = 'ABIJAY';
const ADMIN_PASSWORD = 'ABIJAY2026#';

// Initialize SQLite Database
const db = new sqlite3.Database('./clients.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database');
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      customerIdNo TEXT,
      vehicleNumberPlate TEXT,
      company TEXT,
      premiumPaid REAL,
      insuranceCategory TEXT,
      insuranceType TEXT,
      businessType TEXT,
      startDate DATE,
      expiryDate DATE,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      clientId TEXT NOT NULL,
      claimNumber TEXT NOT NULL,
      claimAmount REAL,
      claimDate DATE,
      status TEXT DEFAULT 'Pending',
      recordType TEXT,
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);
});


// Helper function to run queries with promises
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Run simple migrations to add any missing columns to existing DB tables
(async () => {
  const migrations = [
    `ALTER TABLE clients ADD COLUMN businessType TEXT`,
    `ALTER TABLE clients ADD COLUMN premium REAL`,
    `ALTER TABLE clients ADD COLUMN premiumPaid REAL`,
    `ALTER TABLE clients ADD COLUMN insuranceCategory TEXT`,
    `ALTER TABLE clients ADD COLUMN insuranceType TEXT`,
    `ALTER TABLE clients ADD COLUMN startDate DATE`,
    `ALTER TABLE clients ADD COLUMN expiryDate DATE`
  ];
  for (const sql of migrations) {
    try {
      await runQuery(sql);
      console.log('Applied migration:', sql);
    } catch (err) {
      // ignore errors (likely column already exists)
    }
  }
})();

// Load environment variables for OAuth credentials (create .env with values)
require('dotenv').config();

// Lazy-load googleapis (optional). If not installed, Drive features become no-ops
function tryLoadGoogleApis() {
  try {
    return require('googleapis');
  } catch (err) {
    return null;
  }
}

const OAUTH_SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKENS_PATH = path.join(__dirname, 'drive_tokens.json');

function getOAuthClient() {
  const googleApis = tryLoadGoogleApis();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || (process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : 'http://localhost:5000/auth/google/callback');
  if (!googleApis) return null;
  if (!clientId || !clientSecret) return null;
  return new googleApis.google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

function loadTokens() {
  try {
    if (fs.existsSync(TOKENS_PATH)) {
      return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading tokens:', err.message);
  }
  return null;
}

// Start OAuth flow - open consent screen
app.get('/auth/google', (req, res) => {
  const oAuth2Client = getOAuthClient();
  if (!oAuth2Client) return res.status(500).send('OAuth client not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: OAUTH_SCOPES,
    prompt: 'consent'
  });
  res.redirect(authUrl);
});

// OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  const oAuth2Client = getOAuthClient();
  if (!oAuth2Client) return res.status(500).send('OAuth client not configured.');
  try {
    const {tokens} = await oAuth2Client.getToken(code);
    saveTokens(tokens);
    res.send('Google Drive authorization successful. You can close this window.');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.status(500).send('Authorization failed');
  }
});

// Drive status: whether tokens are stored
app.get('/api/drive/status', (req, res) => {
  const tokens = loadTokens();
  res.json({ authorized: !!tokens });
});

// Upload clients export to Drive (creates a JSON file)
app.post('/api/drive/upload', async (req, res) => {
  const MAX_RETRIES = 3;
  const tokens = loadTokens();
  if (!tokens) return res.status(400).json({ error: 'Not authorized with Google Drive. Visit /auth/google to authorize.' });
  const oAuth2Client = getOAuthClient();
  if (!oAuth2Client) return res.status(500).json({ error: 'OAuth client not configured.' });

  oAuth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });

  // helpers
  const LOG_PATH = path.join(__dirname, 'drive_upload.log');
  function appendLog(line) {
    try {
      const ts = new Date().toISOString();
      fs.appendFileSync(LOG_PATH, `[${ts}] ${line}\n`);
    } catch (e) {
      console.error('Failed to write drive log:', e.message);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function tryUploadOnce(payloadBuffer) {
    const fileMetadata = { name: `clients-export-${Date.now()}.json` };
    const media = { mimeType: 'application/json', body: bufferToStream(payloadBuffer) };
    try {
      // Ensure access token is fresh; this will trigger a refresh if a refresh_token is present
      await oAuth2Client.getAccessToken();
      const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id, name' });
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  try {
    const clients = await allQuery('SELECT * FROM clients ORDER BY name');
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), clients }, null, 2);
    const buffer = Buffer.from(payload, 'utf8');

    let attempt = 0;
    let lastError = null;
    while (attempt < MAX_RETRIES) {
      attempt += 1;
      appendLog(`Upload attempt ${attempt} starting`);
      const result = await tryUploadOnce(buffer);
      if (result.success) {
        appendLog(`Upload succeeded: ${JSON.stringify(result.data)}`);
        // If tokens were refreshed during the upload, save the latest credentials
        const newCreds = oAuth2Client.credentials;
        if (newCreds && (newCreds.access_token || newCreds.refresh_token)) {
          saveTokens({ ...tokens, ...newCreds });
        }
        return res.json({ success: true, file: result.data });
      }

      lastError = result.error;
      appendLog(`Upload failed on attempt ${attempt}: ${result.error.message || result.error}`);

      // If unauthorized and we have refresh token, try to refresh immediately
      if (result.error && result.error.code === 401 && oAuth2Client.credentials && oAuth2Client.credentials.refresh_token) {
        try {
          const refreshed = await oAuth2Client.getAccessToken();
          appendLog('Access token refreshed');
          // Persist if new tokens present
          const newCreds = oAuth2Client.credentials;
          if (newCreds && (newCreds.access_token || newCreds.refresh_token)) saveTokens({ ...tokens, ...newCreds });
        } catch (refreshErr) {
          appendLog(`Refresh failed: ${refreshErr.message || refreshErr}`);
        }
      }

      // exponential backoff before retrying
      const backoffMs = 1000 * Math.pow(2, attempt - 1);
      await sleep(backoffMs);
    }

    appendLog(`All upload attempts failed: ${lastError?.message || lastError}`);
    res.status(500).json({ error: 'Drive upload failed after retries', details: lastError?.message || String(lastError) });
  } catch (err) {
    appendLog(`Unexpected error during upload: ${err.message}`);
    console.error('Drive upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper to create stream from buffer for drive upload
function bufferToStream(buffer) {
  const stream = require('stream');
  const s = new stream.PassThrough();
  s.end(buffer);
  return s;
}

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Client Management API', endpoints: ['/api/clients', '/api/clients/:id', '/api/clients/:clientId/records', '/api/records/:id'] });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      res.json({ success: true, message: 'Login successful', token: 'admin_token_' + Date.now() });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get insurance expiry information
app.get('/api/insurance-expiry', async (req, res) => {
  try {
    const clients = await allQuery('SELECT id, name, vehicleNumberPlate, insuranceCategory, insuranceType, company, expiryDate FROM clients ORDER BY expiryDate');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const clientsWithDaysRemaining = clients.map(client => {
      let daysRemaining = 0;
      let isExpired = false;
      let isExpiringSoon = false;
      
      if (client.expiryDate && client.expiryDate.trim()) {
        const expiryDate = new Date(client.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        isExpired = daysRemaining < 0;
        isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 30;
      }
      
      return {
        ...client,
        daysRemaining,
        isExpired,
        isExpiringSoon
      };
    });
    
    res.json(clientsWithDaysRemaining.sort((a, b) => a.daysRemaining - b.daysRemaining));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await allQuery('SELECT * FROM clients ORDER BY name');
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single client with all records
app.get('/api/clients/:id', async (req, res) => {
  try {
    const client = await getQuery('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    // if aggregate query param provided, find other clients with same name and phone and merge records
    if (req.query.aggregate === 'true') {
      const matchedClients = await allQuery('SELECT * FROM clients WHERE LOWER(name) = LOWER(?) AND phone = ?', [client.name, client.phone || '']);
      const ids = matchedClients.map(c => c.id);
      const placeholders = ids.map(() => '?').join(',');
      let records = [];
      if (ids.length > 0) {
        records = await allQuery(`SELECT * FROM records WHERE clientId IN (${placeholders}) ORDER BY claimDate ASC`, ids);
      }
      // return representative client plus combined records
      const representative = matchedClients[0] || client;
      return res.json({ ...representative, records });
    }

    const records = await allQuery('SELECT * FROM records WHERE clientId = ? ORDER BY claimDate ASC', [req.params.id]);
    res.json({ ...client, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new client
app.post('/api/clients', async (req, res) => {
  try {
    const { name, email, phone, customerIdNo, vehicleNumberPlate, company, premium, premiumPaid, insuranceCategory, insuranceType, businessType, startDate, expiryDate } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    // normalize phone to string so numeric values from the client don't fail typeof checks
    const phoneStr = phone != null ? String(phone) : '';
    if (!/^\d{10}$/.test(phoneStr.trim())) {
      return res.status(400).json({ error: 'Phone number is required and must be 10 digits' });
    }
    const id = uuidv4();
    await runQuery(
      'INSERT INTO clients (id, name, email, phone, customerIdNo, vehicleNumberPlate, company, premium, premiumPaid, insuranceCategory, insuranceType, businessType, startDate, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, email || '', phoneStr || '', customerIdNo || '', vehicleNumberPlate || '', company || '', premium || 0, premiumPaid || 0, insuranceCategory || '', insuranceType || '', businessType || '', startDate || '', expiryDate || '']
    );
    res.json({ id, name, email, phone: phoneStr, customerIdNo, vehicleNumberPlate, company, premium: premium || 0, premiumPaid: premiumPaid || 0, insuranceCategory, insuranceType, businessType, startDate, expiryDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update client
app.put('/api/clients/:id', async (req, res) => {
  try {
    const { name, email, phone, customerIdNo, vehicleNumberPlate, company, premium, premiumPaid, insuranceCategory, insuranceType, businessType, startDate, expiryDate } = req.body;
    // normalize phone to string to accept numeric phone values from clients
    const phoneStr = phone != null ? String(phone) : '';
    if (!/^\d{10}$/.test(phoneStr.trim())) {
      return res.status(400).json({ error: 'Phone number is required and must be 10 digits' });
    }
    await runQuery(
      'UPDATE clients SET name = ?, email = ?, phone = ?, customerIdNo = ?, vehicleNumberPlate = ?, company = ?, premium = ?, premiumPaid = ?, insuranceCategory = ?, insuranceType = ?, businessType = ?, startDate = ?, expiryDate = ? WHERE id = ?',
      [name, email || '', phoneStr || '', customerIdNo || '', vehicleNumberPlate || '', company || '', premium || 0, premiumPaid || 0, insuranceCategory || '', insuranceType || '', businessType || '', startDate || '', expiryDate || '', req.params.id]
    );
    res.json({ id: req.params.id, name, email, phone: phoneStr, customerIdNo, vehicleNumberPlate, company, premium: premium || 0, premiumPaid: premiumPaid || 0, insuranceCategory, insuranceType, businessType, startDate, expiryDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add claim for client
app.post('/api/clients/:clientId/records', async (req, res) => {
  try {
    const { claimNumber, claimAmount, claimDate, status, description, recordType } = req.body;
    if (!claimNumber) {
      return res.status(400).json({ error: 'Claim number is required' });
    }
    if (!recordType) {
      return res.status(400).json({ error: 'Record type is required' });
    }
    const id = uuidv4();
    const currentDate = new Date().toISOString().split('T')[0];
    await runQuery(
      'INSERT INTO records (id, clientId, claimNumber, claimAmount, claimDate, status, recordType, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.clientId, claimNumber, claimAmount || 0, claimDate || currentDate, status || 'Pending', recordType || '', description || '']
    );
    res.json({ id, clientId: req.params.clientId, claimNumber, claimAmount, claimDate: claimDate || currentDate, status: status || 'Pending', recordType, description });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete record
app.delete('/api/records/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM records WHERE id = ?', [req.params.id]);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve React app (production only)
if (fs.existsSync(buildPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
