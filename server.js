// -----------------------------
// Imports & Configurations
// -----------------------------
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// -----------------------------
// Database Setup
// -----------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // REQUIRED on Render
});


// -----------------------------
// Express App Setup
// -----------------------------
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

const buildPath = path.join(__dirname, 'client/build');
if (fs.existsSync(buildPath)) app.use(express.static(buildPath));

// -----------------------------
// Admin Credentials
// -----------------------------
const ADMIN_USERNAME = 'ABIJAY';
const ADMIN_PASSWORD = 'ABIJAY2026#';

// -----------------------------
// Helper: Query Wrappers
// -----------------------------
const runQuery = async (sql, params = []) => {
  try { return (await pool.query(sql, params)).rows; } 
  catch (err) { throw new Error('Database query failed: ' + err.message); }
};
const getQuery = async (sql, params = []) => {
  try { return (await pool.query(sql, params)).rows[0]; } 
  catch (err) { throw new Error('Database query failed: ' + err.message); }
};
const allQuery = async (sql, params = []) => {
  try { return (await pool.query(sql, params)).rows; } 
  catch (err) { throw new Error('Database query failed: ' + err.message); }
};

// -----------------------------
// Create Tables if Missing
// -----------------------------
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        customerIdNo TEXT,
        vehicleNumberPlate TEXT,
        company TEXT,
        premium REAL,
        premiumPaid REAL,
        insuranceCategory TEXT,
        insuranceType TEXT,
        businessType TEXT,
        startDate DATE,
        expiryDate DATE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        clientId TEXT NOT NULL,
        claimNumber TEXT NOT NULL,
        claimAmount REAL,
        claimDate DATE,
        status TEXT DEFAULT 'Pending',
        recordType TEXT,
        description TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);
    console.log('Tables ready');
  } catch (err) { console.error('Database setup error:', err); }
})();

// -----------------------------
// DB Migrations (Add Missing Columns)
// -----------------------------
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
    try { await runQuery(sql); } catch {} // ignore existing columns
  }
})();

// -----------------------------
// Utility: Input Validation
// -----------------------------
const isValidPhone = (phone) => /^\d{10}$/.test(String(phone).trim());
const isValidEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidDate = (date) => !date || !isNaN(new Date(date).getTime());
const parseNumber = (n) => n != null && !isNaN(n) ? Number(n) : 0;

// -----------------------------
// OAuth & Drive Helpers
// -----------------------------
function tryLoadGoogleApis() {
  try { return require('googleapis'); } catch { return null; }
}
const OAUTH_SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKENS_PATH = path.join(__dirname, 'drive_tokens.json');

function getOAuthClient() {
  const googleApis = tryLoadGoogleApis();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
    (process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : 'http://localhost:5000/auth/google/callback');
  if (!googleApis || !clientId || !clientSecret) return null;
  return new googleApis.google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function saveTokens(tokens) {
  try { fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2)); } catch {}
}
function loadTokens() {
  try { return fs.existsSync(TOKENS_PATH) ? JSON.parse(fs.readFileSync(TOKENS_PATH,'utf8')) : null; }
  catch { return null; }
}

// -----------------------------
// Login
// -----------------------------
app.post('/api/login', (req,res)=>{
  try {
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({error:'Username and password required'});
    if(username===ADMIN_USERNAME && password===ADMIN_PASSWORD) return res.json({success:true, token:'admin_token_'+Date.now()});
    res.status(401).json({error:'Invalid credentials'});
  } catch { res.status(500).json({error:'Login failed'}); }
});

// -----------------------------
// Clients CRUD
// -----------------------------
app.get('/api/clients', async (req,res)=>{
  try { res.json(await allQuery('SELECT * FROM clients ORDER BY name')); } 
  catch { res.status(500).json({error:'Failed to fetch clients'}); }
});

app.get('/api/clients/:id', async (req,res)=>{
  try {
    const client = await getQuery('SELECT * FROM clients WHERE id=$1',[req.params.id]);
    if(!client) return res.status(404).json({error:'Client not found'});
    let records = await allQuery('SELECT * FROM records WHERE clientId=$1 ORDER BY claimDate ASC',[req.params.id]);
    if(req.query.aggregate==='true'){
      const matched = await allQuery('SELECT * FROM clients WHERE LOWER(name)=LOWER($1) AND phone=$2',[client.name,client.phone||'']);
      const ids = matched.map(c=>c.id);
      if(ids.length) records = await allQuery('SELECT * FROM records WHERE clientId=ANY($1::text[]) ORDER BY claimDate ASC',[ids]);
    }
    res.json({...client,records});
  } catch { res.status(500).json({error:'Failed to fetch client'}); }
});

app.post('/api/clients', async (req,res)=>{
  try{
    const { name,email,phone,customerIdNo,vehicleNumberPlate,company,premium,premiumPaid,insuranceCategory,insuranceType,businessType,startDate,expiryDate }=req.body;
    if(!name) return res.status(400).json({error:'Name required'});
    if(!isValidPhone(phone)) return res.status(400).json({error:'Phone must be 10 digits'});
    if(!isValidEmail(email)) return res.status(400).json({error:'Invalid email'});
    if(!isValidDate(startDate)||!isValidDate(expiryDate)) return res.status(400).json({error:'Invalid dates'});
    const id=uuidv4();
    await runQuery(`INSERT INTO clients(id,name,email,phone,customerIdNo,vehicleNumberPlate,company,premium,premiumPaid,insuranceCategory,insuranceType,businessType,startDate,expiryDate)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id,name,email||'',phone,customerIdNo||'',vehicleNumberPlate||'',company||'',parseNumber(premium),parseNumber(premiumPaid),insuranceCategory||'',insuranceType||'',businessType||'',startDate||'',expiryDate||'']
    );
    res.status(201).json({id,name,email,phone,customerIdNo,vehicleNumberPlate,company,premium:parseNumber(premium),premiumPaid:parseNumber(premiumPaid),insuranceCategory,insuranceType,businessType,startDate,expiryDate});
  } catch { res.status(500).json({error:'Failed to create client'}); }
});

app.put('/api/clients/:id', async (req,res)=>{
  try{
    const { name,email,phone,customerIdNo,vehicleNumberPlate,company,premium,premiumPaid,insuranceCategory,insuranceType,businessType,startDate,expiryDate }=req.body;
    if(!name) return res.status(400).json({error:'Name required'});
    if(!isValidPhone(phone)) return res.status(400).json({error:'Phone must be 10 digits'});
    if(!isValidEmail(email)) return res.status(400).json({error:'Invalid email'});
    if(!isValidDate(startDate)||!isValidDate(expiryDate)) return res.status(400).json({error:'Invalid dates'});
    await runQuery(`UPDATE clients SET name=$1,email=$2,phone=$3,customerIdNo=$4,vehicleNumberPlate=$5,company=$6,premium=$7,premiumPaid=$8,insuranceCategory=$9,insuranceType=$10,businessType=$11,startDate=$12,expiryDate=$13 WHERE id=$14`,
      [name,email||'',phone,customerIdNo||'',vehicleNumberPlate||'',company||'',parseNumber(premium),parseNumber(premiumPaid),insuranceCategory||'',insuranceType||'',businessType||'',startDate||'',expiryDate||'',req.params.id]
    );
    res.json({id:req.params.id,name,email,phone,customerIdNo,vehicleNumberPlate,company,premium:parseNumber(premium),premiumPaid:parseNumber(premiumPaid),insuranceCategory,insuranceType,businessType,startDate,expiryDate});
  } catch { res.status(500).json({error:'Failed to update client'}); }
});

app.delete('/api/clients/:id', async (req,res)=>{
  try { await runQuery('DELETE FROM clients WHERE id=$1',[req.params.id]); res.json({message:'Client deleted'}); }
  catch { res.status(500).json({error:'Failed to delete client'}); }
});

// -----------------------------
// Records CRUD
// -----------------------------
app.post('/api/clients/:clientId/records', async (req,res)=>{
  try{
    const { claimNumber,claimAmount,claimDate,status,recordType,description }=req.body;
    if(!claimNumber) return res.status(400).json({error:'Claim number required'});
    if(!recordType) return res.status(400).json({error:'Record type required'});
    if(!isValidDate(claimDate)) return res.status(400).json({error:'Invalid claim date'});
    const id=uuidv4();
    await runQuery(`INSERT INTO records(id,clientId,claimNumber,claimAmount,claimDate,status,recordType,description)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id,req.params.clientId,claimNumber,parseNumber(claimAmount),claimDate||new Date().toISOString().split('T')[0],status||'Pending',recordType,description||'']
    );
    res.status(201).json({id,clientId:req.params.clientId,claimNumber,claimAmount:parseNumber(claimAmount),claimDate,status:status||'Pending',recordType,description});
  } catch { res.status(500).json({error:'Failed to add record'}); }
});

app.delete('/api/records/:id', async (req,res)=>{
  try{ await runQuery('DELETE FROM records WHERE id=$1',[req.params.id]); res.json({message:'Record deleted'}); }
  catch{ res.status(500).json({error:'Failed to delete record'}); }
});

// -----------------------------
// Insurance Expiry
// -----------------------------
app.get('/api/insurance-expiry', async (req,res)=>{
  try{
    const clients = await allQuery('SELECT id,name,vehicleNumberPlate,insuranceCategory,insuranceType,company,expiryDate FROM clients ORDER BY expiryDate');
    const today = new Date(); today.setHours(0,0,0,0);
    const clientsWithDaysRemaining = clients.map(client=>{
      let daysRemaining=0,isExpired=false,isExpiringSoon=false;
      if(client.expiryDate){
        const expiry=new Date(client.expiryDate); expiry.setHours(0,0,0,0);
        daysRemaining=Math.ceil((expiry-today)/(1000*60*60*24));
        isExpired=daysRemaining<0;
        isExpiringSoon=daysRemaining>=0 && daysRemaining<=30;
      }
      return {...client,daysRemaining,isExpired,isExpiringSoon};
    });
    res.json(clientsWithDaysRemaining.sort((a,b)=>a.daysRemaining-b.daysRemaining));
  } catch { res.status(500).json({error:'Failed to fetch insurance expiry info'}); }
});

// -----------------------------
// Google Drive Upload
// -----------------------------
app.post('/api/drive/upload', async (req,res)=>{
  const MAX_RETRIES=3;
  const tokens=loadTokens();
  if(!tokens) return res.status(400).json({error:'Not authorized with Google Drive.'});
  const oAuth2Client=getOAuthClient();
  if(!oAuth2Client) return res.status(500).json({error:'OAuth client not configured.'});
  oAuth2Client.setCredentials(tokens);
  const googleApis=tryLoadGoogleApis();
  const drive=googleApis.google.drive({version:'v3',auth:oAuth2Client});
  const appendLog=(line)=>{try{fs.appendFileSync(path.join(__dirname,'drive_upload.log'),`[${new Date().toISOString()}] ${line}\n`);}catch{}};
  const bufferToStream=(buffer)=>{const stream=require('stream');const s=new stream.PassThrough();s.end(buffer);return s;};
  const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
  const tryUploadOnce=async(payloadBuffer)=>{
    try{await oAuth2Client.getAccessToken();
      const response=await drive.files.create({resource:{name:`clients-export-${Date.now()}.json`},media:{mimeType:'application/json',body:bufferToStream(payloadBuffer)},fields:'id,name'});
      return {success:true,data:response.data};
    } catch(err){return {success:false,error:err};}
  };
  try{
    const clients=await allQuery('SELECT * FROM clients ORDER BY name');
    const payloadBuffer=Buffer.from(JSON.stringify({exportedAt:new Date().toISOString(),clients},null,2));
    let attempt=0,lastError=null;
    while(attempt<MAX_RETRIES){
      attempt++;
      appendLog(`Upload attempt ${attempt} starting`);
      const result=await tryUploadOnce(payloadBuffer);
      if(result.success){const newCreds=oAuth2Client.credentials;if(newCreds?.access_token||newCreds?.refresh_token) saveTokens({...tokens,...newCreds}); appendLog(`Upload succeeded: ${JSON.stringify(result.data)}`); return res.json({success:true,file:result.data});}
      lastError=result.error; appendLog(`Upload failed: ${result.error?.message||result.error}`);
      await sleep(1000*Math.pow(2,attempt-1));
    }
    res.status(500).json({error:'Drive upload failed after retries',details:lastError?.message||String(lastError)});
  } catch(err){res.status(500).json({error:'Drive upload failed: '+err.message});}
});

// -----------------------------
// Google OAuth
// -----------------------------
app.get('/auth/google',(req,res)=>{
  const client=getOAuthClient();
  if(!client) return res.status(500).send('OAuth client not configured.');
  const authUrl=client.generateAuthUrl({access_type:'offline',scope:OAUTH_SCOPES,prompt:'consent'});
  res.redirect(authUrl);
});
app.get('/auth/google/callback',async(req,res)=>{
  const code=req.query.code;
  const client=getOAuthClient();
  if(!client) return res.status(500).send('OAuth client not configured.');
  try{const {tokens}=await client.getToken(code); saveTokens(tokens); res.send('Google Drive authorization successful.');} 
  catch{res.status(500).send('Authorization failed');}
});
app.get('/api/drive/status',(req,res)=>{res.json({authorized:!!loadTokens()});});

// -----------------------------
// Root & React Fallback
// -----------------------------
app.get('/',(req,res)=>{res.json({message:'Client Management API',endpoints:['/api/clients','/api/clients/:id','/api/clients/:clientId/records','/api/records/:id']});});
if(fs.existsSync(buildPath)){app.get('*',(req,res)=>{res.sendFile(path.join(buildPath,'index.html'));});}

// -----------------------------
// Global Error Handler
// -----------------------------
app.use((err,req,res,next)=>{console.error('Unhandled error:',err); res.status(500).json({error:'Internal Server Error'});});

// -----------------------------
// Start Server
// -----------------------------
app.listen(PORT,()=>{console.log(`Server running on http://localhost:${PORT}`);});