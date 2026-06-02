// filename: src/index.js
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store recent comments for new clients
const commentHistory = [];
const MAX_HISTORY = 50;

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket connection
wss.on('connection', (ws) => {
  // Send existing history to new client
  ws.send(JSON.stringify({ type: 'history', comments: commentHistory }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'new_comment') {
        const comment = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          username: parsed.username || 'Anonymous',
          text: parsed.text,
          timestamp: new Date().toISOString(),
        };
        commentHistory.push(comment);
        if (commentHistory.length > MAX_HISTORY) {
          commentHistory.shift();
        }
        broadcast({ type: 'new_comment', comment });
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
});

// REST API to post a comment
app.post('/api/comments', (req, res) => {
  const { username, text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required' });
  }
  const comment = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    username: username || 'Anonymous',
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };
  commentHistory.push(comment);
  if (commentHistory.length > MAX_HISTORY) {
    commentHistory.shift();
  }
  broadcast({ type: 'new_comment', comment });
  res.status(201).json(comment);
});

// REST API to get comment history
app.get('/api/comments', (req, res) => {
  res.json(commentHistory);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, server, wss, commentHistory };