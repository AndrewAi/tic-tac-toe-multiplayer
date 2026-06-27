import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve static files from the dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active games
const games = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', (data) => {
    const roomCode = generateRoomCode();
    // Each room remembers which game it hosts so it can size the board and tell
    // joiners what to render. Defaults to tic-tac-toe for older clients that
    // emit createRoom with no payload.
    const gameType = data && data.gameType === 'connect4' ? 'connect4' : 'tictactoe';
    const boardSize = gameType === 'connect4' ? 42 : 9; // 6x7 vs 3x3
    const gameState = {
      roomCode,
      gameType,
      players: [socket.id],
      playerNames: {},
      squares: Array(boardSize).fill(null),
      xIsNext: true,
      history: [Array(boardSize).fill(null)],
      started: false,
      deletionTimer: null // set when a player drops; cancelled if they return
    };

    games.set(roomCode, gameState);
    socket.join(roomCode);

    socket.emit('roomCreated', {
      roomCode,
      playerSymbol: 'X',
      playerId: socket.id,
      gameType
    });

    console.log(`Room created: ${roomCode} (${gameType})`);
  });

  socket.on('joinRoom', (roomCode) => {
    const game = games.get(roomCode);

    if (!game) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (game.players.length >= 2) {
      socket.emit('error', 'Room is full');
      return;
    }

    game.players.push(socket.id);
    game.started = true;
    socket.join(roomCode);

    socket.emit('roomJoined', {
      roomCode,
      playerSymbol: 'O',
      playerId: socket.id,
      gameType: game.gameType
    });

    // Randomly determine who goes first
    game.xIsNext = Math.random() < 0.5;

    // Notify both players that game is starting
    io.to(roomCode).emit('gameStart', {
      players: game.players,
      squares: game.squares,
      xIsNext: game.xIsNext,
      gameType: game.gameType
    });

    console.log(`Player joined room: ${roomCode}`);
  });

  socket.on('makeMove', ({ roomCode, squareIndex }) => {
    const game = games.get(roomCode);

    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }

    if (!game.started) {
      socket.emit('error', 'Waiting for opponent');
      return;
    }

    // Verify it's the correct player's turn
    const currentPlayerIndex = game.xIsNext ? 0 : 1;
    if (game.players[currentPlayerIndex] !== socket.id) {
      socket.emit('error', 'Not your turn');
      return;
    }

    // Verify square is empty
    if (game.squares[squareIndex] !== null) {
      socket.emit('error', 'Square already taken');
      return;
    }

    // Make the move
    game.squares[squareIndex] = game.xIsNext ? 'X' : 'O';
    game.xIsNext = !game.xIsNext;
    game.history.push([...game.squares]);

    // Broadcast the updated game state to all players in the room
    io.to(roomCode).emit('gameUpdate', {
      squares: game.squares,
      xIsNext: game.xIsNext,
      history: game.history
    });

    console.log(`Move made in room ${roomCode}:`, squareIndex);
  });

  socket.on('resetGame', (roomCode) => {
    const game = games.get(roomCode);

    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }

    const boardSize = game.gameType === 'connect4' ? 42 : 9;
    game.squares = Array(boardSize).fill(null);
    game.xIsNext = Math.random() < 0.5; // Randomly determine who goes first
    game.history = [Array(boardSize).fill(null)];

    io.to(roomCode).emit('gameUpdate', {
      squares: game.squares,
      xIsNext: game.xIsNext,
      history: game.history
    });

    console.log(`Game reset in room: ${roomCode}`);
  });

  socket.on('setPlayerName', ({ roomCode, name }) => {
    const game = games.get(roomCode);

    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }

    // Store the player's name
    game.playerNames[socket.id] = name;

    // Notify the opponent of this player's name
    socket.to(roomCode).emit('opponentName', name);

    // If opponent is already in the room and has set their name, send it back to this player
    const opponentId = game.players.find(id => id !== socket.id);
    if (opponentId && game.playerNames[opponentId]) {
      socket.emit('opponentName', game.playerNames[opponentId]);
    }

    console.log(`Player ${socket.id} set name to ${name} in room ${roomCode}`);
  });

  // A player whose socket dropped and reconnected re-claims their seat by room
  // code + symbol. socket.io reconnects with a NEW socket id, so without this the
  // old id lingers in game.players and the room's deletion timer fires mid-game.
  socket.on('rejoinRoom', ({ roomCode, playerSymbol }) => {
    const game = games.get(roomCode);
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }

    // They're back — cancel any pending deletion.
    if (game.deletionTimer) {
      clearTimeout(game.deletionTimer);
      game.deletionTimer = null;
    }

    // Swap the new socket id into the right seat (slot 0 = 'X', slot 1 = 'O')
    // and migrate the player's stored name from their old id.
    const slot = playerSymbol === 'O' ? 1 : 0;
    const oldId = game.players[slot];
    if (oldId && oldId !== socket.id && game.playerNames[oldId]) {
      game.playerNames[socket.id] = game.playerNames[oldId];
      delete game.playerNames[oldId];
    }
    game.players[slot] = socket.id;
    socket.join(roomCode);

    // Re-sync this client to the authoritative state and clear the opponent's
    // "disconnected" warning.
    socket.emit('gameUpdate', {
      squares: game.squares,
      xIsNext: game.xIsNext,
      history: game.history
    });
    socket.to(roomCode).emit('opponentReconnected');

    // Restore name labels on both sides.
    const opponentId = game.players.find((id) => id !== socket.id);
    if (game.playerNames[socket.id]) {
      socket.to(roomCode).emit('opponentName', game.playerNames[socket.id]);
    }
    if (opponentId && game.playerNames[opponentId]) {
      socket.emit('opponentName', game.playerNames[opponentId]);
    }

    console.log(`Player ${socket.id} rejoined room ${roomCode} as ${playerSymbol}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Find games where this player was involved
    for (const [roomCode, game] of games.entries()) {
      if (game.players.includes(socket.id)) {
        // Notify the opponent
        socket.to(roomCode).emit('opponentDisconnected');

        // Schedule deletion, but keep a handle so a reconnect (rejoinRoom) can
        // cancel it. Without the handle the room is deleted 30s later even if
        // the player comes right back.
        if (game.deletionTimer) clearTimeout(game.deletionTimer);
        game.deletionTimer = setTimeout(() => {
          games.delete(roomCode);
          console.log(`Room deleted: ${roomCode}`);
        }, 30000); // 30 seconds grace period
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

// Only start listening when run directly (node server.js). When the test suite
// imports this file, it starts the server itself on an ephemeral port.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Socket.IO server running on port ${PORT}`);
  });
}

export { app, httpServer, io, games };