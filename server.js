const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DATA_FILE = path.join(__dirname, 'data', 'state.json');
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DEFAULT_STATE = {
  deadline: { from: '', to: '' },
  members: [],
  nextId: 10
};

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // Merge: preserve saved members/deadline/nextId, fill missing fields safely
      return {
        deadline: raw.deadline || DEFAULT_STATE.deadline,
        members: (raw.members || []).map(m => ({
          ...m,
          cuts: (m.cuts || []).map(c => ({
            num: c.num ?? 1,
            done: c.done ?? false,
            pct: c.pct ?? 0,
          })),
          comments: m.comments || [],
        })),
        nextId: raw.nextId || DEFAULT_STATE.nextId,
      };
    }
  } catch (e) {
    console.error('Error loading state:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState(state) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving state:', e.message);
  }
}

let state = loadState();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'init', state }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'update') {
      // Safely merge incoming state with existing — never lose data
      state = {
        deadline: msg.state.deadline || state.deadline,
        nextId: msg.state.nextId || state.nextId,
        members: (msg.state.members || []).map(m => ({
          ...m,
          cuts: (m.cuts || []),
          comments: m.comments || [],
        })),
      };
      saveState(state);
      broadcast({ type: 'update', state }, ws);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Team Tracker running at http://localhost:${PORT}`);
});
