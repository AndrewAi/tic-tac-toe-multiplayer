import { useState, useEffect } from 'react';
import { C4_ROWS as ROWS, C4_COLS as COLS, lowestEmptyRow, calculateConnect4Winner } from './gameLogic';

// Connect 4 is a 6-row by 7-column grid. We reuse the same flat `squares`
// array the server already stores (just 42 cells instead of 9), and the same
// 'X'/'O' player markers — rendered here as red ('X') and yellow ('O') discs.
// Board dimensions and win/gravity logic live in ./gameLogic so they're unit-tested.

export default function Connect4Board({ xIsNext, squares, onPlay, playerX, playerO, onGameEnd, currentPlayerSymbol }) {
  const [showModal, setShowModal] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);

  const winner = calculateConnect4Winner(squares);
  const isDraw = !winner && squares.every(square => square !== null);

  // Drop a disc into a column: it falls to the lowest empty row (gravity).
  function handleColumnClick(col) {
    if (winner) return;
    const landingIndex = lowestEmptyRow(squares, col);
    if (landingIndex === -1) return; // column is full
    const nextSquares = squares.slice();
    nextSquares[landingIndex] = xIsNext ? 'X' : 'O';
    onPlay(nextSquares);
  }

  useEffect(() => {
    if (winner) {
      setGameResult({ type: 'win', winner });
      setShowModal(true);
      if (onGameEnd) onGameEnd(winner);
    } else if (isDraw) {
      setGameResult({ type: 'draw' });
      setShowModal(true);
      if (onGameEnd) onGameEnd(null);
    } else {
      // Board was reset (no winner, not a draw) — dismiss any lingering modal.
      setShowModal(false);
      setGameResult(null);
    }
  }, [winner, isDraw]);

  const colorName = (sym) => (sym === 'X' ? 'Red' : 'Yellow');
  const currentPlayerName = xIsNext ? playerX : playerO;
  const winnerName = winner === 'X' ? playerX : winner === 'O' ? playerO : null;

  let status;
  if (winner) {
    status = `Winner: ${winnerName || colorName(winner)}`;
  } else if (isDraw) {
    status = "It's a draw!";
  } else {
    status = `Next: ${currentPlayerName || colorName(xIsNext ? 'X' : 'O')} (${colorName(xIsNext ? 'X' : 'O')})`;
  }

  return (
    <>
      <div className="status">{status}</div>
      <div className="connect4-board">
        {Array.from({ length: COLS }, (_, col) => {
          const isFull = lowestEmptyRow(squares, col) === -1;
          return (
            <div
              key={col}
              className={`connect4-column${hoverCol === col && !isFull && !winner ? ' hovered' : ''}`}
              onClick={() => handleColumnClick(col)}
              onMouseEnter={() => setHoverCol(col)}
              onMouseLeave={() => setHoverCol(null)}
            >
              {Array.from({ length: ROWS }, (_, row) => {
                const index = row * COLS + col;
                const value = squares[index];
                const cellClass = value === 'X' ? 'red' : value === 'O' ? 'yellow' : 'empty';
                return (
                  <div className="connect4-cell" key={index}>
                    <div className={`connect4-disc ${cellClass}`} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {showModal && gameResult && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">
              {gameResult.type === 'win'
                ? (currentPlayerSymbol
                    ? (gameResult.winner === currentPlayerSymbol ? '🎉 You Won!' : '😔 You Lost')
                    : '🎉 Winner!')
                : '🤝 Draw!'}
            </h2>
            <p className="modal-message">
              {gameResult.type === 'win'
                ? `${winnerName || colorName(gameResult.winner)} wins!`
                : "It's a tie!"}
            </p>
            <button className="modal-button" onClick={() => setShowModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
