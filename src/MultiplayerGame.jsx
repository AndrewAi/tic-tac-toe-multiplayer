import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Board from './Board';

// In production (Render), frontend and backend are on same server
// In development, use env variable or localhost:3001
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.PROD ? window.location.origin : `http://${window.location.hostname}:3001`);

export default function MultiplayerGame({ onBackToMenu }) {
  const [socket, setSocket] = useState(null);
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

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('roomCreated', ({ roomCode, playerSymbol, playerId }) => {
      setRoomCode(roomCode);
      setPlayerSymbol(playerSymbol);
      setPlayerId(playerId);
      setWaitingForOpponent(true);
      setShowNamePrompt(true);
      setError('');
    });

    newSocket.on('roomJoined', ({ roomCode, playerSymbol, playerId }) => {
      setRoomCode(roomCode);
      setPlayerSymbol(playerSymbol);
      setPlayerId(playerId);
      setShowNamePrompt(true);
      setError('');
    });

    newSocket.on('gameStart', ({ squares, xIsNext }) => {
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

    newSocket.on('error', (message) => {
      setError(message);
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
      socket.emit('createRoom');
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

  const isMyTurn = (xIsNext && playerSymbol === 'X') || (!xIsNext && playerSymbol === 'O');

  // Lobby view
  if (!roomCode) {
    return (
      <div className="multiplayer-lobby">
        <button className="back-button" onClick={onBackToMenu}>
          ← Back to Menu
        </button>
        <div className="lobby">
          <div className="lobby-header">
            <h1>Multiplayer Tic Tac Toe</h1>
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
            Continue
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
        <h1>Multiplayer Game</h1>
        <div className="room-info">
          <div className="room-code-display">
            <span className="room-label">Room Code:</span>
            <span className="room-code">{roomCode}</span>
            <button className="copy-button" onClick={copyRoomCode}>
              {showCopied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <div className="player-info">
            You are: <strong>{playerSymbol}</strong>
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
            <span className="name-label">You ({playerSymbol}):</span>
            <span className="name-value">{playerName}</span>
          </div>
          {opponentName && (
            <div className="player-name-item">
              <span className="name-label">Opponent ({playerSymbol === 'X' ? 'O' : 'X'}):</span>
              <span className="name-value">{opponentName}</span>
            </div>
          )}
        </div>
      )}

      {waitingForOpponent && (
        <div className="waiting-message">
          <div className="spinner"></div>
          <p>Waiting for opponent to join...</p>
          <p className="room-code-hint">Share room code: <strong>{roomCode}</strong></p>
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
            <Board
              xIsNext={xIsNext}
              squares={squares}
              onPlay={handlePlay}
              playerX={playerSymbol === 'X' ? playerName : opponentName}
              playerO={playerSymbol === 'O' ? playerName : opponentName}
              onGameEnd={handleGameEnd}
              currentPlayerSymbol={playerSymbol}
            />
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