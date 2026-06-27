// Pure game-logic helpers, extracted so they can be unit-tested in isolation
// (no React, no DOM). Both the board components and the test suite import these.

// ----- Tic Tac Toe (3x3) -----

export const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// Returns 'X' / 'O' for the winner, or null if there is none.
export function calculateWinner(squares) {
  for (const [a, b, c] of TTT_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

// ----- Connect 4 (6 rows x 7 cols) -----

export const C4_ROWS = 6;
export const C4_COLS = 7;

// Flat index of the lowest empty cell in a column, or -1 if the column is full.
// Rows run top (0) to bottom (C4_ROWS-1), so we scan from the bottom up.
export function lowestEmptyRow(squares, col) {
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    const index = row * C4_COLS + col;
    if (squares[index] === null) return index;
  }
  return -1;
}

// Scans every cell as the start of a run of 4 in each of four directions
// (right, down, down-right, down-left). Returns 'X' / 'O' or null.
export function calculateConnect4Winner(squares) {
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal down-right
    [1, -1], // diagonal down-left
  ];
  for (let row = 0; row < C4_ROWS; row++) {
    for (let col = 0; col < C4_COLS; col++) {
      const start = squares[row * C4_COLS + col];
      if (!start) continue;
      for (const [dr, dc] of directions) {
        let count = 1;
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLS && squares[r * C4_COLS + c] === start) {
          count++;
          if (count === 4) return start;
          r += dr;
          c += dc;
        }
      }
    }
  }
  return null;
}
