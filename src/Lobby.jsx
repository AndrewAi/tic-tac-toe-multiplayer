import { useState } from 'react';

export default function Lobby({ onCreateRoom, onJoinRoom }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  const handleCreateRoom = () => {
    setError('');
    onCreateRoom();
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    setError('');
    onJoinRoom(roomCode.toUpperCase());
  };

  const handleInputChange = (e) => {
    setRoomCode(e.target.value.toUpperCase());
    setError('');
  };

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1>Multiplayer Tic Tac Toe</h1>
        <p>Play with a friend online!</p>
      </div>

      <div className="lobby-section">
        <h2>Create a New Game</h2>
        <p className="lobby-description">Start a new game and share the room code with your friend</p>
        <button className="lobby-button create-button" onClick={handleCreateRoom}>
          Create Room
        </button>
      </div>

      <div className="lobby-divider">
        <span>OR</span>
      </div>

      <div className="lobby-section">
        <h2>Join a Game</h2>
        <p className="lobby-description">Enter the room code your friend shared with you</p>
        <input
          type="text"
          className="room-input"
          placeholder="Enter Room Code"
          value={roomCode}
          onChange={handleInputChange}
          maxLength={6}
        />
        <button className="lobby-button join-button" onClick={handleJoinRoom}>
          Join Room
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}