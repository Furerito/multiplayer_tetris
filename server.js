const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const games = new Map(); // gameId -> { players: [], started: false }

function generateGameId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  let currentGame = null;
  let playerName = null;

  socket.on('createGame', (name) => {
    const gameId = generateGameId();
    playerName = name;
    games.set(gameId, {
      players: [{ id: socket.id, name, alive: true }],
      started: false
    });
    currentGame = gameId;
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
  });

  socket.on('joinGame', ({ gameId, name }) => {
    if (!games.has(gameId)) return socket.emit('invalidGame');
    
    const game = games.get(gameId);
    playerName = name;
    game.players.push({ id: socket.id, name, alive: true });
    currentGame = gameId;
    socket.join(gameId);
    io.to(gameId).emit('playerJoined', game.players);
  });

  socket.on('startGame', () => {
    if (games.get(currentGame).players[0].id === socket.id) {
      games.get(currentGame).started = true;
      io.to(currentGame).emit('gameStarted');
    }
  });

  socket.on('linesCleared', (lines) => {
    socket.to(currentGame).emit('addGarbage', lines);
  });

  socket.on('playerDead', () => {
    const game = games.get(currentGame);
    const players = game.players.filter(p => p.alive);
    if (players.length === 1) {
      io.to(currentGame).emit('gameWon', players[0]);
    }
  });

  socket.on('disconnect', () => {
    if (currentGame && games.has(currentGame)) {
      const game = games.get(currentGame);
      game.players = game.players.filter(p => p.id !== socket.id);
      if (game.players.length === 0) games.delete(currentGame);
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});

