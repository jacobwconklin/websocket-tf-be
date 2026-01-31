const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createSession, getSession, addPlayerToSession, removePlayerFromSession } = require('./sessionManager');
const Player = require('./models/Player');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/session/create', (req, res) => {
  try {
    const { gameName } = req.body;
    const session = createSession(gameName || null);
    
    res.status(201).json({
      success: true,
      joinCode: session.joinCode,
      gameName: session.gameName
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-session', (data) => {
    const { joinCode, alias, color, font, icon } = data;

    if (!joinCode) {
      socket.emit('join-error', { error: 'Join code is required' });
      return;
    }

    const session = getSession(joinCode);
    if (!session) {
      socket.emit('join-error', { error: 'Invalid join code' });
      return;
    }

    const player = new Player(socket.id, alias, color, font, icon);
    addPlayerToSession(joinCode, player);

    socket.join(joinCode);
    socket.data.joinCode = joinCode;
    socket.data.playerId = socket.id;

    socket.emit('join-success', {
      success: true,
      players: session.players.map(p => p.toJSON()),
      gameName: session.gameName,
      gameState: session.gameState
    });

    socket.to(joinCode).emit('player-joined', {
      player: player.toJSON(),
      players: session.players.map(p => p.toJSON())
    });

    console.log(`Player ${alias} (${socket.id}) joined session ${joinCode}`);
  });

  socket.on('disconnect', () => {
    const { joinCode, playerId } = socket.data;

    if (joinCode && playerId) {
      const session = removePlayerFromSession(joinCode, playerId);
      
      if (session) {
        socket.to(joinCode).emit('player-left', {
          playerId: playerId,
          players: session.players.map(p => p.toJSON())
        });
        console.log(`Player ${playerId} left session ${joinCode}`);
      }
    }

    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };
