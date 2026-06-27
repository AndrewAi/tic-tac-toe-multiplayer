import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Board from './Board';
import Connect4Board from './Connect4Board';

// Display labels keyed by game type. The room creator picks the game; joiners
// (including invite-link arrivals) learn it from the server.
const GAME_LABELS = {
  tictactoe: 'Tic Tac Toe',
  connect4: 'Connect 4',
};

// In production (Render), frontend and backend are on same server
// In development, use env variable or localhost:3001
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.PROD ? window.location.origin : `http://${window.location.hostname}:3001`);

export default function MultiplayerGame({ onBackToMenu, initialRoomCode = '', initialGameType = 'tictactoe' }) {
  const [socket, setSocket] = useState(null);
  // The creator's choice seeds this; the server is the source of truth and
  // overrides it on roomCreated/roomJoined/gameStart (so invite-link joiners
  // render the right game even though it isn't in the URL).
  const [gameType, setGameType] = useState(initialGameType || 'tictactoe');
  const [roomCode, setRoomCode] = useState('');
  const [playerSymbol, setPlayerSymbol] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [squares, setSquares] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [history, setHistory] = useState([Array(9).fill(null)]);
  const [error, setError] = useState('');
  const [opponentConnected, setOpponentConnected] = useState(true);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [inviteCopied, setInviteCopied] = useState(false);
  // A dedicated error for people who arrived via an invite link (room full /
  // not found). Kept separate from `error` so we can show a friendly screen
  // instead of dumping them into the Create/Join lobby.
  const [linkError, setLinkError] = useState('');

  // Refs (not state) because we read them inside the socket effect, whose
  // closure is created once. `joinedViaLinkRef` makes the auto-join fire exactly
  // once even though React 18 StrictMode mounts the effect twice in dev.
  const joinedViaLinkRef = useRef(false);
  // A live mirror of `gameStarted` so the error handler can tell whether a
  // failure happened before play began without reading a stale state value.
  const gameStartedRef = useRef(false);
  // Live mirrors of our seat, read inside the once-created socket effect so a
  // reconnect can re-claim it (the connect handler closure can't see state).
  const roomCodeRef = useRef('');
  const playerSymbolRef = useRef('');

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');

      if (roomCodeRef.current && playerSymbolRef.current) {
        // This is a RECONNECT after a dropped connection mid-game. Re-claim our
        // seat so the server swaps in the new socket id and cancels the room's
        // pending deletion.
        newSocket.emit('rejoinRoom', {
          roomCode: roomCodeRef.current,
          playerSymbol: playerSymbolRef.current,
        });
      } else if (initialRoomCode && !joinedViaLinkRef.current) {
        // First connect from an invite link: auto-join. We emit on the local
        // `newSocket` (guaranteed live here) rather than the `socket` state,
        // which may still be null. The ref guard makes it fire exactly once
        // even if StrictMode runs this effect twice in dev.
        joinedViaLinkRef.current = true;
        newSocket.emit('joinRoom', initialRoomCode);
      }
    });

    newSocket.on('roomCreated', ({ roomCode, playerSymbol, playerId, gameType }) => {
      setRoomCode(roomCode);
      setPlayerSymbol(playerSymbol);
      setPlayerId(playerId);
      roomCodeRef.current = roomCode;
      playerSymbolRef.current = playerSymbol;
      if (gameType) setGameType(gameType);
      setWaitingForOpponent(true);
      setShowNamePrompt(true);
      setError('');
    });

    newSocket.on('roomJoined', ({ roomCode, playerSymbol, playerId, gameType }) => {
      setRoomCode(roomCode);
      setPlayerSymbol(playerSymbol);
      setPlayerId(playerId);
      roomCodeRef.current = roomCode;
      playerSymbolRef.current = playerSymbol;
      if (gameType) setGameType(gameType);
      setShowNamePrompt(true);
      setError('');

      // Now that we're safely in the room, strip ?room= from the address bar so
      // a refresh lands on the normal menu instead of trying to re-join a room
      // that may now be full.
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    newSocket.on('gameStart', ({ squares, xIsNext, gameType }) => {
      gameStartedRef.current = true;
      if (gameType) setGameType(gameType);
      setGameStarted(true);
      setWaitingForOpponent(false);
      setSquares(squares);
      setXIsNext(xIsNext);
      setHistory([squares]);
      setOpponentConnected(true);
    });

    newSocket.on('gameUpdate', ({ squares, xIsNext, history }) => {
      setSquares(squares);
      setXIsNext(xIsNext);
      setHistory(history);
    });

    newSocket.on('opponentDisconnected', () => {
      setOpponentConnected(false);
      setError('Opponent disconnected');
    });

    newSocket.on('opponentReconnected', () => {
      setOpponentConnected(true);
      setError('');
    });

    newSocket.on('error', (message) => {
      // If someone arrived via an invite link and the game never started, the
      // only errors they can hit are "Room not found" / "Room is full". Show a
      // friendly full-screen message instead of the generic lobby error.
      if (initialRoomCode && !gameStartedRef.current) {
        setLinkError(message);
      } else {
        setError(message);
      }
    });

    newSocket.on('opponentName', (name) => {
      setOpponentName(name);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const createRoom = () => {
    if (socket) {
      socket.emit('createRoom', { gameType });
    }
  };

  const joinRoom = (code) => {
    if (socket) {
      socket.emit('joinRoom', code);
    }
  };

  const handlePlay = (nextSquares) => {
    if (!gameStarted) {
      setError('Waiting for opponent to join');
      return;
    }

    const isMyTurn = (xIsNext && playerSymbol === 'X') || (!xIsNext && playerSymbol === 'O');
    if (!isMyTurn) {
      setError('Not your turn!');
      return;
    }

    // Find which square was clicked
    const squareIndex = nextSquares.findIndex((square, index) => square !== squares[index]);

    if (squareIndex !== -1 && socket) {
      socket.emit('makeMove', { roomCode, squareIndex });
      setError('');
    }
  };

  const handleReset = () => {
    if (socket) {
      socket.emit('resetGame', roomCode);
    }
  };

  const handleGameEnd = (winner) => {
    if (winner) {
      setScores(prev => ({
        ...prev,
        [winner]: prev[winner] + 1
      }));
    }
  };

  const submitName = () => {
    if (playerName.trim()) {
      setShowNamePrompt(false);
      if (socket) {
        socket.emit('setPlayerName', { roomCode, name: playerName.trim() });
      }
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // Build the full invite link that gets shared on WhatsApp. `window.location.origin`
  // is the site's base URL (no trailing slash) — "http://localhost:5173" in dev and
  // the real ".onrender.com" address once deployed — so the same code works in both.
  const buildInviteLink = () => `${window.location.origin}/?room=${roomCode}`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(buildInviteLink());
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const isMyTurn = (xIsNext && playerSymbol === 'X') || (!xIsNext && playerSymbol === 'O');

  // The server still tracks players as 'X' and 'O'. In Connect 4 we surface
  // those as the red and yellow discs instead.
  const symbolLabel = (sym) =>
    gameType === 'connect4' ? (sym === 'X' ? '🔴 Red' : '🟡 Yellow') : sym;
  const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X';

  // Invite-link failure view — shown when someone follows a link to a room that
  // is full or no longer exists. Takes priority over the lobby so they never see
  // the Create/Join UI they didn't ask for.
  if (linkError) {
    return (
      <div className="multiplayer-lobby">
        <div className="lobby">
          <div className="lobby-header">
            <h1>Room unavailable</h1>
          </div>
          <p className="modal-message">
            {linkError === 'Room is full'
              ? 'This game already has two players.'
              : "This invite link isn't valid anymore."}
          </p>
          <button className="lobby-button create-button" onClick={onBackToMenu}>
            Go to Menu
          </button>
        </div>
      </div>
    );
  }

  // Lobby view
  if (!roomCode) {
    return (
      <div className="multiplayer-lobby">
        <button className="back-button" onClick={onBackToMenu}>
          ← Back to Menu
        </button>
        <div className="lobby">
          <div className="lobby-header">
            <h1>Multiplayer {GAME_LABELS[gameType] || 'Game'}</h1>
          </div>

          <div className="lobby-section">
            <button className="lobby-button create-button" onClick={createRoom}>
              Create Room
            </button>
          </div>

          <div className="lobby-divider">
            <span>OR</span>
          </div>

          <div className="lobby-section">
            <h2>Join a Game</h2>
            <input
              type="text"
              className="room-input"
              placeholder="Enter Room Code"
              maxLength={6}
              onChange={(e) => {
                const code = e.target.value.toUpperCase();
                if (code.length === 6) {
                  joinRoom(code);
                }
              }}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    );
  }

  // Name prompt modal
  if (showNamePrompt) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2 className="modal-title">👋 Welcome!</h2>
          <p className="modal-message">What's your name?</p>
          <input
            type="text"
            className="name-input"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && submitName()}
            autoFocus
          />
          <button className="modal-button" onClick={submitName}>
            Start Game
          </button>
        </div>
      </div>
    );
  }

  // Game view
  return (
    <div className="game multiplayer-game">
      <button className="back-button small" onClick={onBackToMenu}>
        ← Menu
      </button>

      <div className="game-header">
        <h1>Multiplayer {GAME_LABELS[gameType] || 'Game'}</h1>
        <div className="room-info">
          <div className="room-code-display">
            <span className="room-label">Room Code:</span>
            <span className="room-code">{roomCode}</span>
            <button className="copy-button" onClick={copyRoomCode}>
              {showCopied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <div className="player-info">
            You are: <strong>{symbolLabel(playerSymbol)}</strong>
          </div>
        </div>
      </div>

      {gameStarted && (
        <div className="scoreboard">
          <div className="score-item">
            <span className="score-name">{playerSymbol === 'X' ? playerName : opponentName || 'Player X'}</span>
            <span className="score-value">{scores.X}</span>
          </div>
          <div className="score-divider">-</div>
          <div className="score-item">
            <span className="score-name">{playerSymbol === 'O' ? playerName : opponentName || 'Player O'}</span>
            <span className="score-value">{scores.O}</span>
          </div>
        </div>
      )}

      {playerName && (
        <div className="player-names">
          <div className="player-name-item">
            <span className="name-label">You ({symbolLabel(playerSymbol)}):</span>
            <span className="name-value">{playerName}</span>
          </div>
          {opponentName && (
            <div className="player-name-item">
              <span className="name-label">Opponent ({symbolLabel(opponentSymbol)}):</span>
              <span className="name-value">{opponentName}</span>
            </div>
          )}
        </div>
      )}

      {waitingForOpponent && (
        <div className="waiting-message">
          <div className="spinner"></div>
          <p>Waiting for opponent to join...</p>
          <button className="copy-button" onClick={copyInviteLink}>
            {inviteCopied ? '✓ Link Copied!' : '🔗 Copy Invite Link'}
          </button>
          <p className="room-code-hint">Or share room code: <strong>{roomCode}</strong></p>
        </div>
      )}

      {!opponentConnected && gameStarted && (
        <div className="disconnect-message">
          ⚠️ Opponent disconnected
        </div>
      )}

      {gameStarted && opponentConnected && (
        <>
          <div className="turn-indicator">
            {isMyTurn ? (
              <span className="your-turn">🎮 Your Turn</span>
            ) : (
              <span className="opponent-turn">⏳ Opponent's Turn</span>
            )}
          </div>
          <div className="game-board">
            {gameType === 'connect4' ? (
              <Connect4Board
                xIsNext={xIsNext}
                squares={squares}
                onPlay={handlePlay}
                playerX={playerSymbol === 'X' ? playerName : opponentName}
                playerO={playerSymbol === 'O' ? playerName : opponentName}
                onGameEnd={handleGameEnd}
                currentPlayerSymbol={playerSymbol}
              />
            ) : (
              <Board
                xIsNext={xIsNext}
                squares={squares}
                onPlay={handlePlay}
                playerX={playerSymbol === 'X' ? playerName : opponentName}
                playerO={playerSymbol === 'O' ? playerName : opponentName}
                onGameEnd={handleGameEnd}
                currentPlayerSymbol={playerSymbol}
              />
            )}
            <button className="reset-button" onClick={handleReset}>
              New Game
            </button>
          </div>
        </>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}