// server.js
const WebSocket = require('ws');
const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// Serve the original game files
app.use(express.static(path.join(__dirname)));

// Serve controller file
app.get('/controller', (req, res) => {
    res.sendFile(path.join(__dirname, 'controller.html'));
});

// Create HTTP server
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`Controller URL: http://${net.address}:${port}/controller`);
            }
        }
    }
});

// Set up WebSocket server
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected. Total clients:', clients.size);

    ws.on('message', (message) => {
        const data = message.toString();
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected. Total clients:', clients.size);
    });
});