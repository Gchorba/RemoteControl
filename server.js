const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// Session management
const sessions = new Map(); // Map of sessionId -> { games: Set, controllers: Set }

// Generate a random session ID
function generateSessionId() {
    return crypto.randomBytes(4).toString('hex');
}

// Session class to manage connections
class Session {
    constructor(id) {
        this.id = id;
        this.games = new Set();
        this.controllers = new Set();
        this.createdAt = Date.now();
    }

    addClient(ws, type) {
        if (type === 'game') {
            this.games.add(ws);
        } else if (type === 'controller') {
            this.controllers.add(ws);
        }
        this.broadcastStatus();
    }

    removeClient(ws) {
        this.games.delete(ws);
        this.controllers.delete(ws);
        this.broadcastStatus();
    }

    broadcast(data, sender) {
        // If sender is a controller, send to all games in this session
        if (this.controllers.has(sender)) {
            this.games.forEach(game => {
                if (game.readyState === WebSocket.OPEN) {
                    game.send(data);
                }
            });
        }
    }

    broadcastStatus() {
        const status = {
            type: 'session_status',
            sessionId: this.id,
            games: this.games.size,
            controllers: this.controllers.size,
            timestamp: Date.now()
        };

        const message = JSON.stringify(status);
        [...this.games, ...this.controllers].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    isEmpty() {
        return this.games.size === 0 && this.controllers.size === 0;
    }
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.post('/api/create-session', (req, res) => {
    const sessionId = generateSessionId();
    sessions.set(sessionId, new Session(sessionId));
    res.json({ sessionId });
});

app.get('/api/session/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (session) {
        res.json({
            exists: true,
            games: session.games.size,
            controllers: session.controllers.size
        });
    } else {
        res.json({ exists: false });
    }
});

// Create HTTP server
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    let session = null;
    let clientType = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'register') {
                // Handle registration with session
                session = sessions.get(data.sessionId);
                clientType = data.client;

                if (session) {
                    session.addClient(ws, clientType);
                    ws.send(JSON.stringify({
                        type: 'registered',
                        sessionId: session.id,
                        client: clientType
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid session'
                    }));
                }
            } else if (session) {
                // Handle regular messages within session
                session.broadcast(message, ws);
            }
        } catch (e) {
            console.error('Message handling error:', e);
        }
    });

    ws.on('close', () => {
        if (session) {
            session.removeClient(ws);
            if (session.isEmpty()) {
                sessions.delete(session.id);
                console.log(`Session ${session.id} removed`);
            }
        }
    });
});

// Clean up old sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (session.isEmpty() && now - session.createdAt > 3600000) { // 1 hour
            sessions.delete(id);
            console.log(`Cleaned up inactive session ${id}`);
        }
    }
}, 300000); // Every 5 minutes