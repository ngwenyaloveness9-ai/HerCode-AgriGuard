import express from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, get, update, set, serverTimestamp } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

const PORT = Number(process.env.PORT || 1573);
const HOST = '0.0.0.0';
const ROOT = 'agriguard';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDnnoTgvzkPPPw_NzFQt6nf2hqJD3uWTow',
  authDomain: 'agriguard-211eb.firebaseapp.com',
  databaseURL: 'https://agriguard-211eb-default-rtdb.firebaseio.com',
  projectId: 'agriguard-211eb',
  storageBucket: 'agriguard-211eb.firebasestorage.app',
  messagingSenderId: '376444364234',
  appId: '1:376444364234:web:29ebcb0971bad924dd1b33',
  measurementId: 'G-T5L15QJVEL'
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);
try {
  await signInAnonymously(auth);
  console.log('[Firebase] Anonymous authentication ready.');
} catch (e) {
  console.warn('[Firebase] Anonymous auth unavailable; continuing with database rules:', e.message);
}
let latest = null;
let firebaseConnected = false;
let lastFirebaseError = null;
const clients = new Set();

function num(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true' || v === 'ON' || v === 'on') return true;
  if (v === 0 || v === '0' || v === 'false' || v === 'OFF' || v === 'off') return false;
  return fallback;
}
function first(...values) { return values.find(v => v !== undefined && v !== null); }
function moisturePercent(zone = {}) {
  const direct = num(first(zone.moisturePercent, zone.moisture, zone.percent));
  if (direct !== null) return Math.max(0, Math.min(100, Math.round(direct)));
  const raw = num(zone.moistureRaw);
  if (raw === null) return 0;
  // Fallback only. The ESP32 sketch writes moisturePercent using calibrated values.
  const dry = num(process.env.SOIL_RAW_DRY, 3200), wet = num(process.env.SOIL_RAW_WET, 1200);
  if (dry === wet) return 0;
  return Math.max(0, Math.min(100, Math.round(((dry - raw) * 100) / (dry - wet))));
}
function normalize(raw = {}) {
  const zonesObj = raw.zones || {};
  const env = raw.environment || {};
  const irrigation = raw.irrigation || {};
  const system = raw.system || {};
  const device = raw.device || {};
  const reservoirObj = first(raw.reservoir, irrigation.reservoir, {}) || {};
  const zone = (key, label, crop) => {
    const z = zonesObj[key] || {};
    return { id: label, key, crop: z.crop || crop, name: z.name || `Zone ${label}`, moisture: moisturePercent(z), raw: num(z.moistureRaw, 0), farmId: z.farmId || raw.farm?.id || 'agriguard-farm-001', fieldId: z.fieldId || raw.field?.id || 'agriguard-field-001' };
  };
  const reservoir = num(first(reservoirObj.levelPercent, reservoirObj.percent, irrigation.reservoirPercent, raw.waterLevelPercent, system.reservoirPercent), 0);
  return {
    connected: firebaseConnected && bool(first(system.esp32Online, device.online, true), true),
    firebaseConnected,
    temperature: num(first(env.temperature, env.temperatureC, system.temperature), 0),
    humidity: Math.round(num(first(env.humidity, system.humidity), 0)),
    reservoir: Math.max(0, Math.min(100, Math.round(reservoir))),
    reservoirDistance: num(first(reservoirObj.distanceCm), -1),
    reservoirLow: bool(first(reservoirObj.lowWater), false),
    pumpOn: bool(first(irrigation.pumpOn, irrigation.pump, system.pumpOn), false),
    shadeDeployed: bool(first(raw.climate?.shadeDeployed, system.shadeDeployed, raw.actuators?.shadeDeployed), false),
    pumpCycles: Math.round(num(first(irrigation.pumpCycles, system.pumpCycles), 0)),
    mode: first(system.mode, device.mode, 'LIVE'),
    lastSeen: first(device.lastSeen, system.lastSeen, raw.updatedAt, null),
    zones: [zone('zoneA','A','Macadamia'), zone('zoneB','B','Macadamia'), zone('zoneC','C','Citrus')]
  };
}
function broadcast() {
  const payload = JSON.stringify({ type: 'telemetry', data: normalize(latest || {}) });
  for (const res of clients) res.write(`data: ${payload}\n\n`);
}

onValue(ref(db, ROOT), snap => {
  latest = snap.val() || {};
  firebaseConnected = true;
  lastFirebaseError = null;
  broadcast();
}, err => {
  firebaseConnected = false;
  lastFirebaseError = err?.message || String(err);
  console.error('[Firebase]', lastFirebaseError);
  broadcast();
});

const app = express();
app.use(express.json());
app.get('/api/health', (_req,res) => res.json({ ok:true, port:PORT, firebaseConnected, database:firebaseConfig.databaseURL, root:`/${ROOT}`, error:lastFirebaseError }));
app.get('/api/state', async (_req,res) => {
  try {
    const snap = await get(ref(db, ROOT)); latest = snap.val() || {}; firebaseConnected = true;
    res.json({ ok:true, data:normalize(latest), raw:latest });
  } catch (e) { res.status(503).json({ok:false,error:e.message,data:normalize(latest||{})}); }
});
app.get('/api/events', (req,res) => {
  res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive');
  res.flushHeaders?.(); clients.add(res);
  res.write(`data: ${JSON.stringify({type:'telemetry',data:normalize(latest||{})})}\n\n`);
  const keep = setInterval(()=>res.write(': keepalive\n\n'),15000);
  req.on('close',()=>{clearInterval(keep);clients.delete(res);});
});

async function command(name, value, source='dashboard') {
  const commandId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const payload = { value, source, commandId, requestedAt: Date.now() };
  await update(ref(db, `${ROOT}/commands`), { [name]: payload, lastCommand: name, lastCommandId: commandId });
  await set(ref(db, `${ROOT}/system/lastDashboardCommand`), { name, value, source, commandId, at: serverTimestamp() });
  return payload;
}
app.post('/api/control/pump', async (req,res) => {
  try { const on=bool(req.body?.on); const p=await command('pump',on,req.body?.source); res.json({ok:true,command:p}); }
  catch(e){res.status(500).json({ok:false,error:e.message});}
});

app.listen(PORT, HOST, () => {
  console.log(`[BACKEND] AgriGuard API running on http://localhost:${PORT}`);
  console.log(`[BACKEND] Firebase root: ${firebaseConfig.databaseURL}/${ROOT}`);
});
