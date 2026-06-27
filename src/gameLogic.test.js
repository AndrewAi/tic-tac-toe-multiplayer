import { describe, it, expect } from 'vitest';
import {
  calculateWinner,
  calculateConnect4Winner,
  lowestEmptyRow,
  C4_ROWS,
  C4_COLS,
} from './gameLogic';

const empty = (n) => Array(n).fill(null);

describe('Tic Tac Toe — calculateWinner', () => {
  it('returns null for an empty board', () => {
    expect(calculateWinner(empty(9))).toBeNull();
  });

  it('detects a top-row win', () => {
    const b = empty(9);
    b[0] = b[1] = b[2] = 'X';
    expect(calculateWinner(b)).toBe('X');
  });

  it('detects a column win', () => {
    const b = empty(9);
    b[0] = b[3] = b[6] = 'O';
    expect(calculateWinner(b)).toBe('O');
  });

  it('detects both diagonals', () => {
    const d1 = empty(9);
    d1[0] = d1[4] = d1[8] = 'X';
    expect(calculateWinner(d1)).toBe('X');
    const d2 = empty(9);
    d2[2] = d2[4] = d2[6] = 'O';
    expect(calculateWinner(d2)).toBe('O');
  });

  it('returns null for a full board with no line (draw)', () => {
    // X O X / X O O / O X X — no three in a row
    const draw = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(calculateWinner(draw)).toBeNull();
  });
});

describe('Connect 4 — lowestEmptyRow (gravity)', () => {
  it('drops to the bottom row of an empty column', () => {
    const b = empty(C4_ROWS * C4_COLS);
    // bottom row is row 5 -> index 5*7 + col
    expect(lowestEmptyRow(b, 0)).toBe(5 * C4_COLS + 0);
    expect(lowestEmptyRow(b, 3)).toBe(5 * C4_COLS + 3);
  });

  it('stacks on top of an occupied cell', () => {
    const b = empty(C4_ROWS * C4_COLS);
    b[5 * C4_COLS + 2] = 'X'; // bottom of column 2 taken
    expect(lowestEmptyRow(b, 2)).toBe(4 * C4_COLS + 2);
  });

  it('returns -1 when the column is full', () => {
    const b = empty(C4_ROWS * C4_COLS);
    for (let row = 0; row < C4_ROWS; row++) b[row * C4_COLS + 1] = 'O';
    expect(lowestEmptyRow(b, 1)).toBe(-1);
  });
});

describe('Connect 4 — calculateConnect4Winner', () => {
  const place = (b, row, col, val) => { b[row * C4_COLS + col] = val; };

  it('returns null for an empty board', () => {
    expect(calculateConnect4Winner(empty(C4_ROWS * C4_COLS))).toBeNull();
  });

  it('detects a horizontal 4-in-a-row', () => {
    const b = empty(C4_ROWS * C4_COLS);
    for (let c = 0; c < 4; c++) place(b, 5, c, 'X');
    expect(calculateConnect4Winner(b)).toBe('X');
  });

  it('detects a vertical 4-in-a-row', () => {
    const b = empty(C4_ROWS * C4_COLS);
    for (let r = 2; r < 6; r++) place(b, r, 3, 'O');
    expect(calculateConnect4Winner(b)).toBe('O');
  });

  it('detects a down-right diagonal', () => {
    const b = empty(C4_ROWS * C4_COLS);
    place(b, 2, 0, 'X');
    place(b, 3, 1, 'X');
    place(b, 4, 2, 'X');
    place(b, 5, 3, 'X');
    expect(calculateConnect4Winner(b)).toBe('X');
  });

  it('detects a down-left diagonal', () => {
    const b = empty(C4_ROWS * C4_COLS);
    place(b, 2, 5, 'O');
    place(b, 3, 4, 'O');
    place(b, 4, 3, 'O');
    place(b, 5, 2, 'O');
    expect(calculateConnect4Winner(b)).toBe('O');
  });

  it('does not falsely report 3-in-a-row as a win', () => {
    const b = empty(C4_ROWS * C4_COLS);
    for (let c = 0; c < 3; c++) place(b, 5, c, 'X');
    expect(calculateConnect4Winner(b)).toBeNull();
  });
});
