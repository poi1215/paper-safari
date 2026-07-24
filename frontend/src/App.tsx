import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import LobbyPage from './pages/LobbyPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
