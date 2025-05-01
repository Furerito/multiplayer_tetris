const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Konfiguration
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middleware
app.use(express.static(PUBLIC_DIR));

// Client-Side Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Spiel-Logik
const games = new Map();

function generateGameId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function getGamePlayers(gameId) {
  return games.get(gameId)?.players || [];
}

io.on('connection', (socket) => {
  let currentGame = null;
  let playerName = null;

  // Spiel erstellen
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
    console.log(`Spiel ${gameId} erstellt von ${name}`);
  });

  // Spiel beitreten
  socket.on('joinGame', ({ gameId, name }) => {
    if (!games.has(gameId)) {
      return socket.emit('invalidGame');
    }

    const game = games.get(gameId);
    if (game.started) {
      return socket.emit('gameAlreadyStarted');
    }

    playerName = name;
    game.players.push({ id: socket.id, name, alive: true });
    currentGame = gameId;
    socket.join(gameId);
    io.to(gameId).emit('playerJoined', game.players);
    console.log(`${name} ist Spiel ${gameId} beigetreten`);
  });

  // Spiel starten
  socket.on('startGame', () => {
    const game = games.get(currentGame);
    if (game && game.players[0].id === socket.id && !game.started) {
      game.started = true;
      io.to(currentGame).emit('gameStarted');
      console.log(`Spiel ${currentGame} gestartet`);
    }
  });

  // Garbage-Lines senden
  socket.on('linesCleared', (lines) => {
    if (lines > 0) {
      socket.to(currentGame).emit('addGarbage', lines);
    }
  });

  // Spieler-Tod behandeln
  socket.on('playerDead', () => {
    const game = games.get(currentGame);
    if (game) {
      game.players = game.players.map(p => 
        p.id === socket.id ? { ...p, alive: false } : p
      );
      
      const alivePlayers = game.players.filter(p => p.alive);
      if (alivePlayers.length === 1) {
        io.to(currentGame).emit('gameWon', alivePlayers[0]);
        console.log(`Spiel ${currentGame} gewonnen von ${alivePlayers[0].name}`);
      }
    }
  });

  // Verbindungstrennung
  socket.on('disconnect', () => {
    if (currentGame && games.has(currentGame)) {
      const game = games.get(currentGame);
      game.players = game.players.filter(p => p.id !== socket.id);
      
      if (game.players.length === 0) {
        games.delete(currentGame);
        console.log(`Spiel ${currentGame} entfernt`);
      }
    }
  });
});

// Server starten
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ 
  ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗
  █████╗  █████╗  ██████╔╝██║   ██║█████╗  ██████╔╝
  ██╔══╝  ██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗
  ██║     ███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║
  ╚═╝     ╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝
  
  Laufend auf http://0.0.0.0:${PORT}
  `);
});