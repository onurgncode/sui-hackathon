# SuiQuiz Gas Station

Gas Station service for the SuiQuiz platform that handles sponsored transactions, real-time WebSocket communication, and backend API services.

## Features

- **⛽ Gas Sponsorship**: Enoki-powered gas-free transactions
- **📡 Real-time Communication**: WebSocket server for quiz synchronization
- **🏆 Badge Management**: NFT badge minting and sealing
- **🎮 Quiz Rooms**: Real-time quiz session management
- **📁 Media Storage**: Walrus integration for rich content
- **🔐 Authentication**: Google OAuth support

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Start Production Server**
   ```bash
   npm start
   ```

## Environment Variables

### Required
- `PORT`: Server port (default: 3001)
- `SUI_NETWORK`: Sui network (testnet/mainnet/devnet)
- `SUI_RPC_URL`: Sui RPC endpoint

### Enoki Configuration
- `ENOKI_API_KEY`: Your Enoki API key for gas sponsorship
- `ENOKI_PRIVATE_KEY`: Enoki private key (optional)

### Contract Addresses
- `QUIZ_PACKAGE_ID`: Quiz contract package ID
- `BADGE_PACKAGE_ID`: Badge contract package ID
- `QUIZ_ROOM_PACKAGE_ID`: Quiz room contract package ID

### Media Storage
- `WALRUS_URL`: Walrus API endpoint
- `WALRUS_API_KEY`: Walrus API key

### Google OAuth
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: OAuth redirect URI

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Quiz Rooms
- `POST /api/rooms` - Create new quiz room
- `GET /api/rooms` - List all active rooms
- `GET /api/rooms/:roomCode` - Get room details

### Badge Management
- `POST /api/sponsor-mint-badge` - Mint badge with gas sponsorship
- `POST /api/seal-badge` - Seal badge for official certification
- `GET /api/badges/:address` - Get user's badges

### Media Storage
- `POST /api/upload-media` - Upload media to Walrus
- `GET /api/media/:walrusId` - Get media from Walrus

## WebSocket Events

### Client → Server
- `join-room` - Join a quiz room
- `leave-room` - Leave a quiz room
- `start-quiz` - Start quiz session
- `submit-answer` - Submit quiz answer
- `next-question` - Move to next question

### Server → Client
- `player-joined` - Player joined room
- `player-left` - Player left room
- `room-state` - Room state update
- `quiz-started` - Quiz started
- `next-question` - Next question data
- `answer-submitted` - Answer submission result
- `quiz-finished` - Quiz completed
- `error` - Error message

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Gas Station   │    │   Sui Network   │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Blockchain)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Walrus        │
                       │   (Media)       │
                       └─────────────────┘
```

## Development

### Project Structure
```
gas-station/
├── server.js          # Main server file
├── package.json       # Dependencies
├── env.example        # Environment template
└── README.md          # This file
```

### Adding New Features

1. **New API Endpoints**: Add to `server.js` in the appropriate section
2. **WebSocket Events**: Add event handlers in the `io.on('connection')` section
3. **Database Integration**: Add database logic in helper functions
4. **External Services**: Add new service integrations

## Production Deployment

1. **Environment Setup**
   - Configure all required environment variables
   - Set up proper logging and monitoring
   - Configure rate limiting and security

2. **Database Setup**
   - Set up persistent database (PostgreSQL recommended)
   - Configure connection pooling
   - Set up database migrations

3. **Security**
   - Enable HTTPS
   - Configure CORS properly
   - Set up API rate limiting
   - Use proper key management

4. **Monitoring**
   - Set up health checks
   - Configure logging
   - Set up error tracking
   - Monitor performance metrics

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check CORS configuration
   - Verify frontend URL in server config
   - Check firewall settings

2. **Enoki API Errors**
   - Verify API key configuration
   - Check network connectivity
   - Verify Sui network settings

3. **Transaction Failures**
   - Check Sui network status
   - Verify contract addresses
   - Check gas station balance

### Logs

Server logs include:
- Request/response information
- WebSocket connection events
- Transaction execution results
- Error details and stack traces

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.