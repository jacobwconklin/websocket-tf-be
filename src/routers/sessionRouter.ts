import { Request, Response } from 'express';
import { Server, Socket } from 'socket.io';
import { createSession, getSession, addPlayerToSession, removePlayerFromSession } from '../controllers/sessionController';
import Player from '../models/Player';

// REST API Handlers
export function handleCreateSession(req: Request, res: Response) {
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
}

export function handleGetSession(req: Request, res: Response) {
  const { code } = req.params;
  const session = getSession(code);
  if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
  res.json({ success: true, session: session.toJSON() });
}

// Socket Event Handlers
export function handleJoinSession(socket: Socket, io: Server, data: any) {
  const { joinCode, playerId, alias, color, font, icon } = data;

  if (!joinCode) {
    socket.emit('join-error', { error: 'Join code is required' });
    return;
  }

  if (!playerId) {
    socket.emit('join-error', { error: 'Player ID is required' });
    return;
  }

  const session = getSession(joinCode);
  if (!session) {
    socket.emit('join-error', { error: 'Invalid join code' });
    return;
  }

  if (session.started) {
    socket.emit('join-error', { error: 'Session is already underway' });
    return;
  }

  // Use client-provided player ID
  const player = new Player(playerId, alias, color, font, icon);
  addPlayerToSession(joinCode, player);

  socket.join(joinCode);
  (socket as any).data.joinCode = joinCode;
  (socket as any).data.playerId = playerId; // Store client-provided ID
  (socket as any).data.socketId = socket.id; // Store socket ID separately for socket management

  // Reply to the joining socket with full session state
  const sessionAfterJoin = getSession(joinCode)!;
  socket.emit('join-success', {
    success: true,
    players: sessionAfterJoin.players.map(p => p.toJSON()),
    gameName: sessionAfterJoin.gameName,
    gameState: sessionAfterJoin.gameState
  });

  // Notify others in room about the new player and emit an updated party state
  io.to(joinCode).emit('player-joined', {
    player: player.toJSON(),
    players: sessionAfterJoin.players.map(p => p.toJSON())
  });

  io.to(joinCode).emit('partyState', {
    players: sessionAfterJoin.players.map(p => p.toJSON()),
    gameStarted: sessionAfterJoin.started
  });

  console.log(`Player ${alias} (${playerId}) joined session ${joinCode} via socket ${socket.id}`);
}

export function handleLeaveSession(socket: Socket, io: Server, data: any) {
  const { code } = data || {};
  const sessionCode = code || (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;
  if (!sessionCode || !playerId) return;

  const session = removePlayerFromSession(sessionCode, playerId);
  if (session) {
    io.to(sessionCode).emit('player-left', {
      playerId: playerId,
      players: session.players.map(p => p.toJSON())
    });

    io.to(sessionCode).emit('partyState', {
      players: session.players.map(p => p.toJSON()),
      gameStarted: session.started
    });

    console.log(`Player ${playerId} left session ${sessionCode}`);
  }
}

export function handleDisconnect(socket: Socket, io: Server) {
  const joinCode = (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;

  if (joinCode && playerId) {
    const session = removePlayerFromSession(joinCode, playerId);

    if (session) {
      io.to(joinCode).emit('player-left', {
        playerId: playerId,
        players: session.players.map(p => p.toJSON())
      });

      io.to(joinCode).emit('partyState', {
        players: session.players.map(p => p.toJSON()),
        gameStarted: session.started
      });

      console.log(`Player ${playerId} left session ${joinCode}`);
    }
  }

  console.log('Client disconnected:', socket.id);
}
