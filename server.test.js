import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { httpServer, io as ioServer, games } from './server.js';
import { io as ioClient } from 'socket.io-client';

// Integration tests: boot the real Socket.IO server on an ephemeral port and
// drive it with real clients. Covers the room lifecycle and — most importantly —
// the reconnection path that the "New Game" bug came from.

let port;
const clients = [];

function connect() {
  const c = ioClient(`http://localhost:${port}`, { forceNew: true, transports: ['websocket'] });
  clients.push(c);
  return c;
}
const once = (sock, ev) => new Promise((res) => sock.once(ev, res));

async function startedGame(gameType = 'tictactoe') {
  const a = connect();
  await once(a, 'connect');
  a.emit('createRoom', { gameType });
  const created = await once(a, 'roomCreated');
  const b = connect();
  await once(b, 'connect');
  const startA = once(a, 'gameStart');
  b.emit('joinRoom', created.roomCode);
  const joined = await once(b, 'roomJoined');
  const start = await startA;
  return { a, b, roomCode: created.roomCode, created, joined, start };
}

beforeAll(async () => {
  await new Promise((res) => httpServer.listen(0, res));
  port = httpServer.address().port;
});

afterEach(() => {
  clients.forEach((c) => c.close());
  clients.length = 0;
  for (const [code, game] of games.entries()) {
    if (game.deletionTimer) clearTimeout(game.deletionTimer);
    games.delete(code);
  }
});

afterAll(() => {
  ioServer.close();
  httpServer.close();
});

describe('room creation & joining', () => {
  it('creates a room with the requested game type', async () => {
    const a = connect();
    await once(a, 'connect');
    a.emit('createRoom', { gameType: 'connect4' });
    const created = await once(a, 'roomCreated');
    expect(created.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(created.playerSymbol).toBe('X');
    expect(created.gameType).toBe('connect4');
  });

  it('defaults to tic-tac-toe and sizes the board to 9', async () => {
    const { start } = await startedGame('tictactoe');
    expect(start.gameType).toBe('tictactoe');
    expect(start.squares).toHaveLength(9);
  });

  it('sizes a Connect 4 board to 42', async () => {
    const { start } = await startedGame('connect4');
    expect(start.squares).toHaveLength(42);
  });

  it('makes the joiner O and starts the game', async () => {
    const { joined } = await startedGame();
    expect(joined.playerSymbol).toBe('O');
  });

  it('errors when joining a nonexistent room', async () => {
    const a = connect();
    await once(a, 'connect');
    const err = once(a, 'error');
    a.emit('joinRoom', 'ZZZZZZ');
    expect(await err).toBe('Room not found');
  });
});

describe('turn enforcement', () => {
  it('rejects a move from the player whose turn it is not', async () => {
    const { a, b, roomCode, start } = await startedGame();
    const wrong = start.xIsNext ? b : a; // X's turn => O (b) is wrong
    const err = once(wrong, 'error');
    wrong.emit('makeMove', { roomCode, squareIndex: 0 });
    expect(await err).toBe('Not your turn');
  });
});

describe('reconnection (regression for the "New Game" bug)', () => {
  it('arms a deletion timer when a player drops', async () => {
    const { b, roomCode } = await startedGame();
    b.close();
    await new Promise((r) => setTimeout(r, 150));
    expect(games.get(roomCode).deletionTimer).not.toBeNull();
  });

  it('cancels deletion and reclaims the seat on rejoin, so New Game still works', async () => {
    const { b, roomCode } = await startedGame();

    // Joiner's socket drops (network blip).
    b.close();
    await new Promise((r) => setTimeout(r, 150));
    expect(games.get(roomCode).deletionTimer).not.toBeNull();

    // Reconnect as a brand-new socket and reclaim the O seat.
    const c = connect();
    await once(c, 'connect');
    const resync = once(c, 'gameUpdate');
    c.emit('rejoinRoom', { roomCode, playerSymbol: 'O' });
    await resync;

    // Pending deletion is cancelled and the new socket holds the O seat.
    expect(games.get(roomCode).deletionTimer).toBeNull();
    expect(games.get(roomCode).players[1]).toBe(c.id);

    // The originally-failing action — New Game — now succeeds with no error.
    let err = null;
    c.once('error', (m) => { err = m; });
    const upd = once(c, 'gameUpdate');
    c.emit('resetGame', roomCode);
    const updated = await upd;
    expect(err).toBeNull();
    expect(updated.squares.every((s) => s === null)).toBe(true);
  });
});
