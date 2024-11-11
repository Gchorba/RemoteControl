const WebSocket = require('ws');
const express = require('express');
const path = require('path');

// Express app setup
const app = express();
const port = process.env.PORT || 3000;

// Connection tracking
const clients = new Set();
let connectionCounter = 0;

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic error handling for express
app.use((err, req, res, next) => {
    console.error(`${new Date().toISOString()} - Error:`, err);
    res.status(500).send('Internal Server Error');
});

// Create HTTP server
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`${new Date().toISOString()} - Server running on port ${port}`);
    console.log(`${new Date().toISOString()} - Server URL: ${getServerUrl()}`);
});

// WebSocket server setup
const wss = new WebSocket.Server({ server });

// Broadcast to all connected clients
function broadcast(data, sender) {
    clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            try {
                client.send(data);
            } catch (e) {
                console.error(`${new Date().toISOString()} - Broadcast error:`, e);
            }
        }
    });
}

// Helper function to get server URL
function getServerUrl() {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL;
    }
    return `http://localhost:${port}`;
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const clientId = ++connectionCounter;
    const clientIp = req.socket.remoteAddress;
    console.log(`${new Date().toISOString()} - Client ${clientId} connected from ${clientIp}`);
    
    // Add client to set
    clients.add(ws);
    console.log(`${new Date().toISOString()} - Total clients: ${clients.size}`);

    // Send initial connection status
    try {
        ws.send(JSON.stringify({
            type: 'connection_status',
            clientId: clientId,
            totalClients: clients.size
        }));
    } catch (e) {
        console.error(`${new Date().toISOString()} - Error sending welcome message:`, e);
    }

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            // Parse message if it's JSON
            let parsedMessage;
            try {
                parsedMessage = JSON.parse(message);
                // Add timestamp and client ID
                parsedMessage.timestamp = Date.now();
                parsedMessage.clientId = clientId;
                message = JSON.stringify(parsedMessage);
            } catch (e) {
                // If not JSON, keep original message
                console.log(`${new Date().toISOString()} - Raw message received from client ${clientId}`);
            }

            // Broadcast message to all other clients
            broadcast(message, ws);

        } catch (e) {
            console.error(`${new Date().toISOString()} - Message handling error:`, e);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        clients.delete(ws);
        console.log(`${new Date().toISOString()} - Client ${clientId} disconnected. Total clients: ${clients.size}`);
        
        // Notify remaining clients about disconnection
        broadcast(JSON.stringify({
            type: 'client_disconnected',
            clientId: clientId,
            totalClients: clients.size,
            timestamp: Date.now()
        }), ws);
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error(`${new Date().toISOString()} - WebSocket error for client ${clientId}:`, error);
        try {
            ws.close();
        } catch (e) {
            console.error(`${new Date().toISOString()} - Error closing connection:`, e);
        }
    });
});

// Handle server errors
server.on('error', (error) => {
    console.error(`${new Date().toISOString()} - Server error:`, error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(`${new Date().toISOString()} - SIGTERM received. Closing server...`);
    server.close(() => {
        console.log(`${new Date().toISOString()} - Server closed`);
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error(`${new Date().toISOString()} - Could not close connections in time, forcefully shutting down`);
        process.exit(1);
    }, 10000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(`${new Date().toISOString()} - Uncaught Exception:`, error);
    // Attempt graceful shutdown
    server.close(() => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(`${new Date().toISOString()} - Unhandled Rejection at:`, promise, 'reason:', reason);
});