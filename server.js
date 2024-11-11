//Server.js

const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// Session management
const sessions = new Map();

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
        console.log(`Session created: ${id}`);
    }

    addClient(ws, type) {
        if (type === 'game') {
            this.games.add(ws);
            console.log(`Game added to session ${this.id}`);
        } else if (type === 'controller') {
            this.controllers.add(ws);
            console.log(`Controller added to session ${this.id}`);
        }
        this.broadcastStatus();
    }

    removeClient(ws) {
        this.games.delete(ws);
        this.controllers.delete(ws);
        console.log(`Client removed from session ${this.id}`);
        this.broadcastStatus();
    }

    broadcast(data, sender) {
        try {
            const messageString = typeof data === 'string' ? data : JSON.stringify(data);
            
            // If sender is a controller, send to all games in this session
            if (this.controllers.has(sender)) {
                this.games.forEach(game => {
                    if (game.readyState === WebSocket.OPEN) {
                        try {
                            game.send(messageString);
                        } catch (e) {
                            console.error(`Error sending to game in session ${this.id}:`, e);
                        }
                    }
                });
            }
        } catch (e) {
            console.error(`Broadcast error in session ${this.id}:`, e);
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
                try {
                    client.send(message);
                } catch (e) {
                    console.error(`Error sending status in session ${this.id}:`, e);
                }
            }
        });
    }

    isEmpty() {
        return this.games.size === 0 && this.controllers.size === 0;
    }
}

// Middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.post('/api/create-session', (req, res) => {
    const sessionId = generateSessionId();
    sessions.set(sessionId, new Session(sessionId));
    console.log(`New session created: ${sessionId}`);
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
    console.log(`Server time: ${new Date().toISOString()}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log(`New connection from ${clientIp}`);
    
    let session = null;
    let clientType = null;

    ws.on('message', (message) => {
        try {
            // Convert buffer or blob to string
            const messageString = message.toString();
            let data;
            
            try {
                data = JSON.parse(messageString);
            } catch (e) {
                console.error('Invalid JSON:', messageString);
                return;
            }

            if (data.type === 'register') {
                // Handle registration with session
                session = sessions.get(data.sessionId);
                clientType = data.client;

                if (session) {
                    session.addClient(ws, clientType);
                    ws.send(JSON.stringify({
                        type: 'registered',
                        sessionId: session.id,
                        client: clientType,
                        timestamp: Date.now()
                    }));
                    console.log(`Client registered as ${clientType} in session ${session.id}`);
                } else {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid session',
                        timestamp: Date.now()
                    }));
                    console.error(`Invalid session ID: ${data.sessionId}`);
                }
            } else if (session) {
                // Add timestamp if not present
                if (!data.timestamp) {
                    data.timestamp = Date.now();
                }
                // Handle regular messages within session
                session.broadcast(data, ws);
            }
        } catch (e) {
            console.error('Message handling error:', e);
        }
    });

    ws.on('close', () => {
        if (session) {
            session.removeClient(ws);
            console.log(`Client disconnected from session ${session.id}`);
            if (session.isEmpty()) {
                sessions.delete(session.id);
                console.log(`Empty session removed: ${session.id}`);
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (session) {
            session.removeClient(ws);
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

// Handle server shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down...');
    wss.close(() => {
        console.log('WebSocket server closed');
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    });
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Attempt graceful shutdown
    wss.close(() => {
        server.close(() => {
            process.exit(1);
        });
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});