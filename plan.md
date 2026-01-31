# Simple Socket.IO Server - Implementation Plan

## Project Overview

A Socket.IO backend server for multiplayer games with session management and real-time communication.

## Architecture

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.IO v4.8.1
- **CORS**: cors v2.8.5

### Data Models

#### Session Object
- `joinCode`: 8-digit alphanumeric code
- `gameName`: Current game name
- `players`: Array of Player objects
- `gameState`: JSON object for game state
- `createdAt`: Timestamp

#### Player Object
- `id`: Unique player identifier
- `alias`: Player display name
- `color`: Player color
- `font`: Player font preference
- `icon`: Player icon (string)

### Storage
- In-memory Map: `joinCode` → `Session`

## Implementation Steps

### ✅ Step 1: Project Setup and Dependencies
**Status**: Complete

**Completed Tasks**:
- ✅ Added socket.io dependency to package.json
- ✅ Added cors dependency for cross-origin support
- ✅ Created basic project structure (src/ directory)
- ✅ Added npm scripts (start, dev) to package.json
- ✅ Installed dependencies with npm install

### ✅ Step 2: Core Models and Utilities
**Status**: Complete

**Completed Tasks**:
- ✅ Created `src/utils/codeGenerator.js` - Generates 8-digit alphanumeric join codes
- ✅ Created `src/models/Player.js` - Player class with id, alias, color, font, icon
- ✅ Created `src/models/Session.js` - Session class with joinCode, gameName, players array, gameState

**Files Created**:
```
src/
├── utils/
│   └── codeGenerator.js
└── models/
    ├── Player.js
    └── Session.js
```

### 🔲 Step 3: Session Manager
**Status**: Pending

**Tasks**:
- Create `src/sessionManager.js`
- Implement in-memory sessions Map storage
- Implement `createSession()` function
- Implement `getSession(joinCode)` function
- Implement `addPlayerToSession(joinCode, player)` function
- Implement `removePlayerFromSession(joinCode, playerId)` function

### 🔲 Step 4: HTTP Endpoint - Create Session
**Status**: Pending

**Tasks**:
- Create `src/server.js` with Express setup
- Configure Express middleware (json, cors)
- Implement POST `/api/session/create` endpoint
- Return joinCode in response
- Handle errors appropriately

### 🔲 Step 5: Socket.IO Integration
**Status**: Pending

**Tasks**:
- Integrate socket.io with Express server
- Implement `join-session` event handler
  - Validate join code
  - Add player to session
  - Join socket to room
  - Emit success/error responses
- Implement `disconnect` event handler for cleanup
- Broadcast `player-joined` events to room participants

### 🔲 Step 6: Testing and Final Verification
**Status**: Pending

**Tasks**:
- Manual test complete flow (create → join → multiple players)
- Test edge cases (invalid codes, disconnects, empty sessions)
- Run linter if configured
- Document any issues encountered

## API Specification

### REST Endpoints

#### POST /api/session/create
Creates a new game session.

**Response**:
```json
{
  "joinCode": "ABC12345"
}
```

### Socket.IO Events

#### Client → Server

**join-session**
```json
{
  "joinCode": "ABC12345",
  "player": {
    "alias": "Player1",
    "color": "#FF0000",
    "font": "Arial",
    "icon": "star"
  }
}
```

**Response (success)**:
```json
{
  "success": true,
  "players": [/* array of players */]
}
```

**Response (error)**:
```json
{
  "success": false,
  "error": "Invalid join code"
}
```

#### Server → Client

**player-joined**
```json
{
  "player": {
    "id": "socket-id",
    "alias": "Player1",
    "color": "#FF0000",
    "font": "Arial",
    "icon": "star"
  }
}
```

**player-left**
```json
{
  "playerId": "socket-id"
}
```

## Current Status

**Completed**: 2/6 steps (33%)

**Next Step**: Implement Session Manager

## Notes

- Sessions are stored in-memory only (will be lost on server restart)
- Join codes are 8-digit alphanumeric codes (A-Z, 0-9)
- Each session is isolated using Socket.IO rooms
- Players are automatically removed on disconnect
