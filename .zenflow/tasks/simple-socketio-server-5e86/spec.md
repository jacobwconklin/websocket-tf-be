# Technical Specification: Socket.IO Multiplayer Game Server

## Difficulty Assessment
**Medium**
- Requires socket.io integration with Express
- In-memory state management with concurrent access considerations
- Multiple endpoints and event handlers
- Error handling for invalid join codes and edge cases

## Technical Context

### Language & Runtime
- **Language**: JavaScript (Node.js)
- **Runtime**: Node.js (latest LTS recommended)

### Dependencies
- **Existing**: `express` (^4.22.1)
- **Required**: 
  - `socket.io` (^4.x) - WebSocket library for real-time communication
  - `cors` (optional, for cross-origin requests if needed)

### Architecture Pattern
- RESTful HTTP endpoints for session creation
- WebSocket (socket.io) for real-time game state updates and joining sessions
- In-memory storage (Map) for session data

## Implementation Approach

### 1. Server Setup
- Create an Express server with socket.io integration
- Configure CORS if needed for client connections
- Set up appropriate port (default: 3000 or from environment variable)

### 2. Data Models

#### Session Object
```javascript
{
  joinCode: string,        // 8-digit alphanumeric code
  players: Player[],       // Array of player objects
  gameName: string,        // Current game name
  gameState: object        // JSON object for game state
}
```

#### Player Object
```javascript
{
  id: string,              // Unique player/socket ID
  alias: string,           // Player display name
  color: string,           // Player color
  font: string,            // Player font preference
  icon: string             // Icon identifier
}
```

### 3. Storage
- **In-Memory Map**: `sessions = new Map<string, Session>()`
- Key: 8-digit join code
- Value: Session object
- No persistence (data lost on server restart)

### 4. Join Code Generation
- Generate random 8-character alphanumeric codes
- Ensure uniqueness by checking existing codes
- Format: Uppercase letters and numbers (e.g., "A3B7K9M2")

### 5. API Endpoints

#### HTTP Endpoints (REST)
1. **POST /api/session/create**
   - Creates a new game session
   - Generates unique 8-digit join code
   - Initializes empty session object
   - **Response**: `{ success: true, joinCode: string }`

#### Socket.IO Events
2. **Event: `join-session`**
   - **Payload**: `{ joinCode: string, playerData: { alias, color, font, icon } }`
   - Validates join code exists
   - Adds player to session's player list
   - Joins socket to room named after join code
   - **Response (emit)**: 
     - Success: `join-success` with `{ players: Player[], session: Session }`
     - Failure: `join-error` with `{ message: string }`
   - **Broadcast**: Notify other players in session of new player

3. **Event: `leave-session`** (optional but recommended)
   - Remove player from session
   - Broadcast to other players

4. **Event: `disconnect`** (built-in)
   - Clean up player from any sessions they're in
   - Broadcast to remaining players

### 6. Error Handling
- Invalid join code: Return error message "Invalid join code"
- Duplicate player in session: Handle gracefully
- Session not found: Clear error response
- Malformed requests: Validate input data

## Source Code Structure

### New Files to Create
```
src/
├── server.js              # Main entry point, Express + Socket.IO setup
├── sessionManager.js      # Session CRUD operations and join code generation
├── models/
│   ├── Session.js         # Session data model/class
│   └── Player.js          # Player data model/class
└── utils/
    └── codeGenerator.js   # Join code generation utility
```

### Alternative Simpler Structure (if project prefers single file)
```
server.js                  # All logic in one file
```

## Data Flow

### Create Session Flow
1. Client sends POST to `/api/session/create`
2. Server generates unique 8-digit code
3. Server creates Session object with empty players array
4. Server stores in sessions Map
5. Server responds with join code

### Join Session Flow
1. Client connects via socket.io
2. Client emits `join-session` with join code and player data
3. Server validates join code exists in sessions Map
4. Server adds player to session's players array
5. Server joins socket to room (join code)
6. Server emits `join-success` to client with all players
7. Server broadcasts `player-joined` to other players in room

## Verification Approach

### Testing Strategy
1. **Manual Testing**:
   - Start server and verify it listens on port
   - Create session via HTTP POST, verify join code returned
   - Connect socket.io client, join with valid code
   - Verify player list returned
   - Join with invalid code, verify error

2. **Integration Tests** (if time permits):
   - Test session creation
   - Test joining with valid/invalid codes
   - Test multiple players in same session
   - Test disconnect handling

3. **Linting**:
   - Use ESLint with standard/airbnb config (if configured)
   - Check for: `npm run lint` or add script

### Manual Verification Steps
1. Start server: `node src/server.js` or `npm start`
2. Create session: `curl -X POST http://localhost:3000/api/session/create`
3. Use Postman or socket.io client to test join functionality
4. Verify console logs show proper state management

## Additional Considerations

### Scalability Limitations
- In-memory storage limits to single server instance
- No session persistence across restarts
- Consider Redis for production multi-instance deployment

### Security
- Join codes provide basic access control
- No authentication/authorization implemented
- Consider rate limiting for session creation

### Future Enhancements (Out of Scope)
- Session expiration/cleanup
- Maximum players per session
- Game state update events
- Spectator mode
- Session password protection
