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

  socket.on('createRoom', () => {
    const roomCode = generateRoomCode();
    const gameState = {
      roomCode,
      players: [socket.id],
      playerNames: {},
      squares: Array(9).fill(null),
      xIsNext: true,
      history: [Array(9).fill(null)],
      started: false
    };

    games.set(roomCode, gameState);
    socket.join(roomCode);

    socket.emit('roomCreated', {
      roomCode,
      playerSymbol: 'X',
      playerId: socket.id
    });

    console.log(`Room created: ${roomCode}`);
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
      playerId: socket.id
    });

    // Randomly determine who goes first
    game.xIsNext = Math.random() < 0.5;

    // Notify both players that game is starting
    io.to(roomCode).emit('gameStart', {
      players: game.players,
      squares: game.squares,
      xIsNext: game.xIsNext
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

    game.squares = Array(9).fill(null);
    game.xIsNext = Math.random() < 0.5; // Randomly determine who goes first
    game.history = [Array(9).fill(null)];

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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Find and clean up games where this player was involved
    for (const [roomCode, game] of games.entries()) {
      if (game.players.includes(socket.id)) {
        // Notify other players
        socket.to(roomCode).emit('opponentDisconnected');

        // Remove game after a delay to allow reconnection
        setTimeout(() => {
          games.delete(roomCode);
          console.log(`Room deleted: ${roomCode}`);
        }, 30000); // 30 seconds grace period
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});