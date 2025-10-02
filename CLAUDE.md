# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Development:
- `npm run dev` - Start Vite dev server for frontend (port 5173)
- `npm run server` - Start Socket.IO backend server (port 3001)
- `npm run dev:all` - Run both frontend and backend concurrently
- `npm run build` - Build production bundle with Vite
- `npm run preview` - Preview production build

## Architecture

This is a React-based multiplayer Tic Tac Toe game with real-time capabilities.

### Frontend Structure
- **[App.jsx](src/App.jsx)**: Main application component handling game mode selection (menu, local, multiplayer)
- **[Board.jsx](src/Board.jsx)**: Tic Tac Toe board component with game logic including `calculateWinner()` function
- **[Square.jsx](src/Square.jsx)**: Individual square component
- **[MultiplayerGame.jsx](src/MultiplayerGame.jsx)**: Handles multiplayer game state, Socket.IO client connection, lobby system, and real-time synchronization

### Backend
- **[server.js](server.js)**: Socket.IO server managing:
  - Room creation with 6-character codes
  - Player connections (2 per room)
  - Game state synchronization via events: `createRoom`, `joinRoom`, `makeMove`, `resetGame`
  - Disconnect handling with 30-second grace period

### Socket.IO Communication
The client connects to `http://192.168.0.101:3001` (hardcoded in [MultiplayerGame.jsx:5](src/MultiplayerGame.jsx#L5)).

Client emits: `createRoom`, `joinRoom`, `makeMove`, `resetGame`
Server emits: `roomCreated`, `roomJoined`, `gameStart`, `gameUpdate`, `opponentDisconnected`, `error`

### Game State Management
- Local mode: Uses React state with history tracking for move replay
- Multiplayer mode: Server maintains authoritative state in `games` Map, synchronized to clients via Socket.IO
- Turn validation enforced server-side based on player socket IDs

### Key Implementation Details
- Room codes are 6-character uppercase alphanumeric strings
- Player 1 (room creator) is always 'X', Player 2 (joiner) is 'O'
- History tracking exists but is only actively used in local mode
- Opponent disconnect shows warning but doesn't reset game state
