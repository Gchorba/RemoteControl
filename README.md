# WebSocket Touch Controller System

A flexible WebSocket-based touch/mouse controller system that allows you to control web games/applications from different devices. The system supports multiple simultaneous sessions, making it perfect for multiplayer installations or interactive displays.

## ▲ DEMO
https://touchcontroller.onrender.com/


## 🚀 Features

- Real-time touch/mouse control
- Session-based connections
- QR code for easy mobile connection
- Support for multiple simultaneous sessions
- Visual feedback and debugging tools
- Auto-reconnection handling
- Cross-device compatibility
- Low latency communication

## 📋 Prerequisites

- Node.js (v14.0.0 or higher)
- npm (Node Package Manager)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd touch-controller
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node server.js
```

4. Access the application:
- Main interface: `http://localhost:3000`
- Game screen: `http://localhost:3000/game.html`
- Controller: `http://localhost:3000/controller.html`

## 📁 Project Structure

```
touch-controller/
├── server.js               # WebSocket server and session management
├── package.json           # Project dependencies
└── public/               # Static files
    ├── index.html        # Landing page
    ├── game.html         # Game display
    ├── controller.html   # Touch controller
    └── your-game/        # Your custom game files
```

## 🎮 Integrating Your Own Game

### Method 1: Using the Existing Game Template

1. Create a new HTML file in the `public` folder:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Game</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Your game styles */
    </style>
</head>
<body>
    <div id="game-container">
        <!-- Your game elements -->
    </div>

    <script>
        // WebSocket connection setup
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
        
        ws.onopen = () => {
            // Register as a game
            ws.send(JSON.stringify({
                type: 'register',
                client: 'game',
                sessionId: sessionId // Get from URL or create new
            }));
        };

        // Handle controller input
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type !== 'session_status' && data.type !== 'registered') {
                handleGameInput(data);
            }
        };

        function handleGameInput(data) {
            // data contains:
            // - x, y: Normalized coordinates (0-1)
            // - type: Event type (touchstart, touchmove, etc.)
            // - isDragging: Boolean indicating drag state
            // - inputType: 'touch' or 'mouse'
            
            // Your game input handling code here
        }
    </script>
</body>
</html>
```

### Method 2: Integration with Existing Games

1. Add the WebSocket client code to your game:
```javascript
class TouchController {
    constructor(options = {}) {
        this.onInput = options.onInput || (() => {});
        this.setupWebSocket();
    }

    setupWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type !== 'session_status' && data.type !== 'registered') {
                this.onInput(data);
            }
        };
    }
}

// Usage in your game:
const controller = new TouchController({
    onInput: (data) => {
        // Handle input in your game
        // data.x, data.y - normalized coordinates (0-1)
        // data.type - event type
        // data.isDragging - drag state
    }
});
```

### Example: Simple Game Integration

```javascript
// In your game code
class Game {
    constructor() {
        this.player = document.getElementById('player');
        this.setupController();
    }

    setupController() {
        this.controller = new TouchController({
            onInput: (data) => {
                // Convert normalized coordinates to game coordinates
                const x = data.x * window.innerWidth;
                const y = data.y * window.innerHeight;
                
                // Move player
                this.player.style.left = `${x}px`;
                this.player.style.top = `${y}px`;
            }
        });
    }
}
```

## 📡 WebSocket Message Format

### Controller to Game Messages:
```javascript
{
    type: string,        // Event type (touchstart, touchmove, etc.)
    x: number,          // Normalized X coordinate (0-1)
    y: number,          // Normalized Y coordinate (0-1)
    inputType: string,  // 'touch' or 'mouse'
    isDragging: boolean,// Drag state
    sessionId: string,  // Session identifier
    timestamp: number   // Event timestamp
}
```

## 🔒 Security Considerations

1. Session Management:
   - Sessions are unique per game instance
   - Controllers can only communicate with their assigned game
   - Sessions expire after inactivity

2. Input Validation:
   - All messages are validated before processing
   - Coordinates are normalized (0-1)
   - Rate limiting on input messages

## 📱 Mobile Device Support

- Touch events support
- Screen orientation handling
- Viewport optimization
- Prevent unwanted gestures
- Visual feedback

## 🐛 Debugging

1. Enable console logging:
```javascript
const DEBUG = true;
if (DEBUG) {
    ws.onmessage = (event) => {
        console.log('Received:', event.data);
        // ... rest of your code
    };
}
```

2. Monitor connection status:
- Check status display in top-left corner
- Watch browser console for WebSocket messages
- Monitor server console for connection logs

## 📦 Deployment

1. Local Network:
```bash
node server.js
```

2. Using Process Manager (PM2):
```bash
npm install -g pm2
pm2 start server.js
```

3. On Render/Heroku:
- Push to GitHub
- Connect repository to hosting platform
- Deploy

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - Feel free to use in your projects
