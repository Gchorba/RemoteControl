const WebSocket = require('ws');
const express = require('express');
const path = require('path');

// Express app setup
const app = express();
const port = process.env.PORT || 3000;

// Connection tracking with roles
const connections = {
    controllers: new Map(), // Store controller connections
    games: new Map(),      // Store game connections
    counter: 0
};

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Route handlers
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/controller', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'controller.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Create HTTP server
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`${new Date().toISOString()} - Server running on port ${port}`);
});

// WebSocket server setup
const wss = new WebSocket.Server({ 
    server,
    clientTracking: true
});

// Broadcast to all game clients
function broadcastToGames(data, senderId) {
    connections.games.forEach((client, id) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify({
                    ...JSON.parse(data),
                    senderId,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.error(`Error broadcasting to game ${id}:`, e);
            }
        }
    });
}

// Send connection statistics
function broadcastStats() {
    const stats = {
        type: 'stats',
        controllers: connections.controllers.size,
        games: connections.games.size,
        timestamp: Date.now()
    };
    
    const message = JSON.stringify(stats);
    
    [...connections.controllers.values(), ...connections.games.values()].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (e) {
                console.error('Error sending stats:', e);
            }
        }
    });
}

// Handle new WebSocket connection
wss.on('connection', (ws, req) => {
    const clientId = ++connections.counter;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Function to handle client registration
    const registerClient = (type) => {
        if (type === 'controller') {
            connections.controllers.set(clientId, ws);
            console.log(`Controller ${clientId} connected from ${clientIp}`);
        } else if (type === 'game') {
            connections.games.set(clientId, ws);
            console.log(`Game ${clientId} connected from ${clientIp}`);
        }
        broadcastStats();
    };

    // Handle messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Handle registration message
            if (data.type === 'register') {
                registerClient(data.client);
                ws.send(JSON.stringify({
                    type: 'registered',
                    id: clientId,
                    client: data.client
                }));
                return;
            }
            
            // Handle controller input
            if (connections.controllers.has(clientId)) {
                broadcastToGames(message, clientId);
            }
            
        } catch (e) {
            console.error(`Error handling message from client ${clientId}:`, e);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        const wasController = connections.controllers.delete(clientId);
        const wasGame = connections.games.delete(clientId);
        
        console.log(`Client ${clientId} disconnected (${wasController ? 'controller' : wasGame ? 'game' : 'unregistered'})`);
        broadcastStats();
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        try {
            ws.close();
        } catch (e) {
            console.error(`Error closing connection for client ${clientId}:`, e);
        }
    });

    // Send initial welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Please register as either a controller or game',
        timestamp: Date.now()
    }));
});

// Handle server shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
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
    wss.close(() => {
        server.close(() => {
            process.exit(1);
        });
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});