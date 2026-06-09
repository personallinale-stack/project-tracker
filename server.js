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

// Default state
const DEFAULT_STATE = {
  deadline: { from: '', to: '' },
  members: [
    { id: 1, name: 'موظف 1', color: 0, cuts: [{ num: 1, done: false, pct: 0 }] },
    { id: 2, name: 'موظف 2', color: 1, cuts: [{ num: 1, done: false, pct: 0 }] },
  ],
  nextId: 10
};

// Load or init state
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState(state) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {}
}

let state = loadState();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Broadcast to all connected clients
function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  // Send current state to new client
  ws.send(JSON.stringify({ type: 'init', state }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'update') {
      state = msg.state;
      saveState(state);
      // Broadcast update to all other clients
      broadcast({ type: 'update', state }, ws);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Team Tracker running at http://localhost:${PORT}`);
});
