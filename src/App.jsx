import { useState } from 'react';
import Board from './Board';
import MultiplayerGame from './MultiplayerGame';
import './App.css';

export default function App() {
  const [gameMode, setGameMode] = useState('menu'); // 'menu', 'local', 'multiplayer'
  const [history, setHistory] = useState([Array(9).fill(null)]);
  const [currentMove, setCurrentMove] = useState(0);
  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove];

  function handlePlay(nextSquares) {
    const nextHistory = [...history.slice(0, currentMove + 1), nextSquares];
    setHistory(nextHistory);
    setCurrentMove(nextHistory.length - 1);
  }

  function jumpTo(nextMove) {
    setCurrentMove(nextMove);
  }

  function resetGame() {
    setHistory([Array(9).fill(null)]);
    setCurrentMove(0);
  }

  function startLocalGame() {
    setGameMode('local');
    resetGame();
  }

  function startMultiplayerGame() {
    setGameMode('multiplayer');
  }

  function backToMenu() {
    setGameMode('menu');
    resetGame();
  }

  // Main menu
  if (gameMode === 'menu') {
    return (
      <div className="game menu">
        <div className="game-header">
          <h1>Tic Tac Toe</h1>
          <p className="subtitle">Choose your game mode</p>
        </div>
        <div className="menu-buttons">
          <button className="menu-button multiplayer-button" onClick={startMultiplayerGame}>
            🌐 Online Multiplayer
            <span className="menu-button-desc">Play with a friend online</span>
          </button>
        </div>
      </div>
    );
  }

  // Multiplayer mode
  if (gameMode === 'multiplayer') {
    return <MultiplayerGame onBackToMenu={backToMenu} />;
  }

  // Local game mode
  const moves = history.map((squares, move) => {
    let description;
    if (move > 0) {
      description = 'Go to move #' + move;
    } else {
      description = 'Go to game start';
    }
    return (
      <li key={move}>
        <button className="history-button" onClick={() => jumpTo(move)}>
          {description}
        </button>
      </li>
    );
  });

  return (
    <div className="game">
      <button className="back-button" onClick={backToMenu}>
        ← Back to Menu
      </button>
      <div className="game-header">
        <h1>Local Game</h1>
      </div>
      <div className="game-board">
        <Board xIsNext={xIsNext} squares={currentSquares} onPlay={handlePlay} />
        <button className="reset-button" onClick={resetGame}>
          New Game
        </button>
      </div>
      <div className="game-info">
        <h3>History</h3>
        <ol>{moves}</ol>
      </div>
    </div>
  );
}