import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { RoomLobby } from './pages/RoomLobby';
import { GameBoard } from './pages/GameBoard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room" element={<RoomLobby />} />
      <Route path="/game" element={<GameBoard />} />
    </Routes>
  );
}

export default App;
