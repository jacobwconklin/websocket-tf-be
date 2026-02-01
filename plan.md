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
- `started`: Boolean flag indicating whether the session/game has started (defaults to `false`)

#### Player Object
- `id`: Unique player identifier
- `alias`: Player display name
- `color`: Player color
- `font`: Player font preference
- `icon`: Player icon (string)

### Storage
- In-memory Map: `joinCode` → `Session`

## Project Structure (updated)

Key source files and responsibilities:

```
src/
├── controllers/
│   ├── sessionController.ts           # session CRUD and in-memory store
│   ├── gameStateController.ts         # routes game updates to game-specific controllers
│   └── games/
│       ├── quickkeysController.ts     # QuickKeys game logic and state updates
│       ├── spacebarinvadersController.ts  # SpaceBarInvaders game logic
│       ├── textsplosionController.ts  # TextSplosion game logic
│       └── typeflightController.ts    # TypeFlight game logic
├── models/
│   ├── Player.ts
│   └── Session.ts
├── routers/
│   ├── sessionRouter.ts               # REST handlers + session socket event handlers
│   └── gameStateRouter.ts             # game update socket event handlers
├── utils/
│   └── codeGenerator.ts
└── server.ts                          # minimal, delegates to routers
```

Notes:
- `server.ts` only wires middleware, mounts REST handlers, and registers socket event listeners that delegate to router functions.
- Session-related logic (creating sessions, joining, leaving, etc.) lives in `sessionController.ts` and `sessionRouter.ts`.
- Game-related logic (update-game endpoint) lives in `gameStateController.ts` and game-specific controllers.
- Each game controller handles its own state updates, win conditions, and returns only deltas for efficient broadcasting.

## Implementation Progress

**Completed Tasks**:
- ✅ Added socket.io dependency to package.json
- ✅ Added cors dependency for cross-origin support
- ✅ Created basic project structure (src/ directory)
- ✅ Added npm scripts (start, dev) to package.json
- ✅ Installed dependencies with npm install
- ✅ Created `src/utils/codeGenerator.ts` - Generates 8-digit alphanumeric join codes
- ✅ Created `src/models/Player.ts` - Player class with id, alias, color, font, icon
- ✅ Created `src/models/Session.ts` - Session class with joinCode, gameName, players array, gameState, started flag
- ✅ Refactored server.ts to delegate logic to router functions
- ✅ Created `src/routers/sessionRouter.ts` - Handles session REST endpoints and socket events
- ✅ Created `src/controllers/sessionController.ts` - Session CRUD operations
- ✅ Implemented join-session validation to reject players if session.started is true
- ✅ Created `src/routers/gameStateRouter.ts` - Handles start-game and update-game socket events
- ✅ Created `src/controllers/gameStateController.ts` - Routes game initialization and updates to game-specific controllers
- ✅ Created game-specific controllers for all four games with initialize and update functions
- ✅ Moved start-game logic to gameStateRouter/gameStateController for proper game initialization
- ✅ Implemented delta-based broadcasting for efficient game state updates

**Socket Events**:
- `join-session` - Player joins a session (rejected if session already started)
- `start-game` - Initializes and starts a game (see Game Flow below)
- `update-game` - Player sends game state update, broadcasts delta to all players (see Game Flow below)
- `game-status` - Request full session data for current player's session (returns complete session object)
- `leave-session` - Player leaves session
- `disconnect` - Player disconnected

## Game Flow

### Starting a Game (`start-game`)

When a client emits `start-game` with a `gameName`:

1. **gameStateRouter.handleStartGame()** validates the player is in a session
2. **gameStateController.startGame()** is called:
   - Sets `session.gameName` to the provided gameName
   - Routes to the appropriate game initializer (`initializeQuickKeys`, `initializeSpaceBarInvaders`, etc.)
   - If gameName doesn't match a known game, sets `session.gameName = "games"` with empty state (for game selection page)
   - Sets `session.started = true`
   - Returns the full Session object
3. **Router broadcasts** the complete session (players, gameName, gameState) to all players via `game-started` event
4. All clients receive synchronized initial state and can render the game

### Updating Game State (`update-game`)

When a client emits `update-game` with game-specific data:

1. **gameStateRouter.handleUpdateGame()** validates the player is in a session
2. **gameStateController.updateGame()** is called:
   - Validates session exists and has started
   - Routes to game-specific update function based on `session.gameName`
   - Game controller processes the update:
     - Updates `session.gameState` with new values
     - Checks win conditions
     - Returns only the **delta** (changes) to broadcast
3. **Router broadcasts** only the delta to all players via `game-upda

### Requesting Game Status (`game-status`)

When a client emits `game-status` (typically on page load):

1. **gameStateRouter.handleGameStatus()** validates the player is in a session
2. **sessionController.getSession()** retrieves the current session
3. **Router responds** with the complete session data (players, gameName, gameState) to the requesting player only via `game-status` event
4. Client uses this to initialize/sync their local state when joining or navigating to a game page

This endpoint is particularly useful when:
- A player navigates directly to a game page (e.g., `/games/quickkeys`)
- A player refreshes the page during a game
- A player needs to re-sync their state with the serverte` event
4. Clients apply the delta to their local state for efficient updates

**Game-Specific Controllers:**
- Each game has `initialize<GameName>()` - Returns initial game state
- Each game has `update<GameName>()` - Processes updates and returns deltas
- Controllers track game-specific logic (scoring, lives, positions, win conditions, etc.)

**REST Endpoints**:
- `POST /api/session/create` - Create a new session
- `GET /api/session/:code` - Get session details

**Files Created**:
```
src/
├── utils/
│   └── codeGenerator.ts
├── models/
│   ├── Player.ts
│   └── Session.ts
├── controllers/
│   ├── sessionController.ts
│   ├── gameStateController.ts
│   └── games/
│       ├── quickkeysController.ts
│       ├── spacebarinvadersController.ts
│       ├── textsplosionController.ts
│       └── typeflightController.ts
├── routers/
│   ├── sessionRouter.ts
│   └── gameStateRouter.ts
└── server.ts
```

## Notes

- Sessions are stored in-memory only (will be lost on server restart)
- Join codes are 8-digit alphanumeric codes (A-Z, 0-9)
- Each session is isolated using Socket.IO rooms
- Players are automatically removed on disconnect
