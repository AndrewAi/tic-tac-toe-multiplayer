import { useState, useEffect } from 'react';
import Square from './Square';

export default function Board({ xIsNext, squares, onPlay, playerX, playerO, onGameEnd, currentPlayerSymbol }) {
  const [showModal, setShowModal] = useState(false);
  const [gameResult, setGameResult] = useState(null);

  function handleClick(i) {
    if (calculateWinner(squares) || squares[i]) {
      return;
    }
    const nextSquares = squares.slice();
    nextSquares[i] = xIsNext ? 'X' : 'O';
    onPlay(nextSquares);
  }

  const winner = calculateWinner(squares);
  const isDraw = !winner && squares.every(square => square !== null);

  useEffect(() => {
    if (winner) {
      setGameResult({ type: 'win', winner });
      setShowModal(true);
      if (onGameEnd) {
        onGameEnd(winner);
      }
    } else if (isDraw) {
      setGameResult({ type: 'draw' });
      setShowModal(true);
      if (onGameEnd) {
        onGameEnd(null);
      }
    }
  }, [winner, isDraw]);

  const currentPlayerName = xIsNext ? playerX : playerO;
  const winnerName = winner === 'X' ? playerX : winner === 'O' ? playerO : null;

  let status;
  if (winner) {
    status = `Winner: ${winnerName || winner}`;
  } else if (isDraw) {
    status = "It's a draw!";
  } else {
    status = `Next player: ${currentPlayerName || (xIsNext ? 'X' : 'O')}`;
  }

  return (
    <>
      <div className="status">{status}</div>
      <div className="board">
        {[0, 1, 2].map(row => (
          <div className="board-row" key={row}>
            {[0, 1, 2].map(col => {
              const index = row * 3 + col;
              return (
                <Square
                  key={index}
                  value={squares[index]}
                  onSquareClick={() => handleClick(index)}
                />
              );
            })}
          </div>
        ))}
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
                ? (currentPlayerSymbol
                    ? (gameResult.winner === currentPlayerSymbol
                        ? 'Congratulations!'
                        : `${winnerName || `Player ${gameResult.winner}`} wins!`)
                    : `${winnerName || `Player ${gameResult.winner}`} wins!`)
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

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}