import { Request, Response } from 'express';
import { Server, Socket } from 'socket.io';
import {
  createSession,
  getSession,
  addPlayerToSession,
  removePlayerFromSession,
  endSession,
  markPlayerConnected,
  markPlayerDisconnected,
  scheduleDisconnectExpiry,
  clearDisconnectTimer,
  DISCONNECT_GRACE_MS
} from '../controllers/sessionController';
import Player from '../models/Player';
import { isDuplicateEvent } from '../utils/idempotency';

function detachFromPreviousSession(socket: Socket, io: Server, nextJoinCode: string) {
  const previousJoinCode = (socket as any).data.joinCode as string | undefined;
  const previousPlayerId = (socket as any).data.playerId as string | undefined;

  if (!previousJoinCode || previousJoinCode === nextJoinCode || !previousPlayerId) {
    return;
  }

  const previousSession = getSession(previousJoinCode);
  if (!previousSession) {
    socket.leave(previousJoinCode);
    (socket as any).data.joinCode = undefined;
    (socket as any).data.playerId = undefined;
    return;
  }

  const updatedSession = removePlayerFromSession(previousJoinCode, previousPlayerId);
  if (updatedSession) {
    if (updatedSession.hostPlayerId === previousPlayerId) {
      updatedSession.setHostPlayerId(null);
    }

    io.to(previousJoinCode).emit('player-left', {
      playerId: previousPlayerId,
      players: updatedSession.players.map(p => p.toJSON())
    });

    io.to(previousJoinCode).emit('partyState', {
      players: updatedSession.players.map(p => p.toJSON()),
      gameStarted: updatedSession.started,
      phase: updatedSession.phase
    });

    io.to(previousJoinCode).emit('session-snapshot', {
      session: updatedSession.toSnapshot()
    });
  }

  clearDisconnectTimer(previousJoinCode, previousPlayerId);
  socket.leave(previousJoinCode);
  (socket as any).data.joinCode = undefined;
  (socket as any).data.playerId = undefined;
}

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
  res.json({ success: true, session: session.toSnapshot() });
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

  if (playerId === 'guest') {
    socket.emit('join-error', { error: 'Invalid player identity. Please rejoin from the player screen.' });
    return;
  }

  detachFromPreviousSession(socket, io, joinCode);

  const session = getSession(joinCode);
  if (!session) {
    socket.emit('join-error', { error: 'Invalid join code' });
    return;
  }

  const existingPlayer = session.getPlayer(playerId);

  const canJoinLobby = session.phase === 'lobby' && session.lobbyOpen;

  if (!canJoinLobby && !existingPlayer) {
    socket.emit('join-error', { error: 'Session is already underway' });
    return;
  }

  let joinedPlayer: Player;
  if (existingPlayer) {
    existingPlayer.alias = alias ?? existingPlayer.alias;
    existingPlayer.color = color ?? existingPlayer.color;
    existingPlayer.font = font ?? existingPlayer.font;
    existingPlayer.icon = icon ?? existingPlayer.icon;
    const marked = markPlayerConnected(joinCode, playerId, socket.id);
    if (!marked) {
      socket.emit('join-error', { error: 'Unable to restore player state' });
      return;
    }
    joinedPlayer = marked.getPlayer(playerId)!;
  } else {
    joinedPlayer = new Player(playerId, alias, color, font, icon);
    joinedPlayer.markConnected(socket.id);
    addPlayerToSession(joinCode, joinedPlayer);
  }

  socket.join(joinCode);
  (socket as any).data.joinCode = joinCode;
  (socket as any).data.playerId = playerId; // Store client-provided ID
  (socket as any).data.socketId = socket.id; // Store socket ID separately for socket management

  // Reply to the joining socket with full session state
  const sessionAfterJoin = getSession(joinCode)!;
  if (!sessionAfterJoin.hostPlayerId) {
    sessionAfterJoin.setHostPlayerId(playerId);
  }

  socket.emit('join-success', {
    success: true,
    players: sessionAfterJoin.players.map(p => p.toJSON()),
    gameName: sessionAfterJoin.gameName,
    gameState: sessionAfterJoin.gameState,
    session: sessionAfterJoin.toSnapshot()
  });

  io.to(joinCode).emit('session-snapshot', {
    session: sessionAfterJoin.toSnapshot()
  });

  // Notify others in room about the new player and emit an updated party state
  io.to(joinCode).emit('player-joined', {
    player: joinedPlayer.toJSON(),
    players: sessionAfterJoin.players.map(p => p.toJSON())
  });

  io.to(joinCode).emit('player-connection-changed', {
    playerId,
    connectionState: 'connected',
    graceMs: DISCONNECT_GRACE_MS
  });

  io.to(joinCode).emit('partyState', {
    players: sessionAfterJoin.players.map(p => p.toJSON()),
    gameStarted: sessionAfterJoin.started,
    phase: sessionAfterJoin.phase
  });

  console.log(`Player ${alias} (${playerId}) joined session ${joinCode} via socket ${socket.id}`);
}

export function handleRejoinSession(socket: Socket, io: Server, data: any, ack?: (payload: any) => void) {
  const { joinCode, playerId } = data || {};
  const eventId = data?.eventId as string | undefined;

  if (!joinCode || !playerId) {
    socket.emit('rejoin-failed', { error: 'Join code and player ID are required' });
    if (ack) ack({ success: false, error: 'Join code and player ID are required' });
    return;
  }

  if (playerId === 'guest') {
    socket.emit('rejoin-failed', { error: 'Invalid player identity', reason: 'invalid-player-id' });
    if (ack) ack({ success: false, error: 'Invalid player identity', reason: 'invalid-player-id' });
    return;
  }

  detachFromPreviousSession(socket, io, joinCode);

  const session = getSession(joinCode);
  if (!session) {
    socket.emit('rejoin-failed', { error: 'Session not found', reason: 'session-not-found' });
    if (ack) ack({ success: false, error: 'Session not found', reason: 'session-not-found' });
    return;
  }

  if (isDuplicateEvent(`${joinCode}:${playerId}:rejoin-session`, eventId)) {
    if (ack) ack({ success: true, duplicate: true, session: session.toSnapshot() });
    return;
  }

  const player = session.getPlayer(playerId);
  if (!player) {
    socket.emit('rejoin-failed', { error: 'Player not found in session', reason: 'player-not-found' });
    if (ack) ack({ success: false, error: 'Player not found in session', reason: 'player-not-found' });
    return;
  }

  if (player.connectionState === 'kicked') {
    socket.emit('rejoin-failed', { error: 'Player was removed by host', reason: 'kicked' });
    if (ack) ack({ success: false, error: 'Player was removed by host', reason: 'kicked' });
    return;
  }

  const updatedSession = markPlayerConnected(joinCode, playerId, socket.id);
  if (!updatedSession) {
    socket.emit('rejoin-failed', { error: 'Failed to restore player connection', reason: 'internal' });
    if (ack) ack({ success: false, error: 'Failed to restore player connection', reason: 'internal' });
    return;
  }

  socket.join(joinCode);
  (socket as any).data.joinCode = joinCode;
  (socket as any).data.playerId = playerId;
  (socket as any).data.socketId = socket.id;

  socket.emit('rejoin-success', {
    success: true,
    session: updatedSession.toSnapshot()
  });

  io.to(joinCode).emit('player-connection-changed', {
    playerId,
    connectionState: 'connected',
    graceMs: DISCONNECT_GRACE_MS
  });

  io.to(joinCode).emit('session-snapshot', {
    session: updatedSession.toSnapshot()
  });

  if (ack) ack({ success: true, session: updatedSession.toSnapshot() });
}

export function handleHostKickPlayer(socket: Socket, io: Server, data: any, ack?: (payload: any) => void) {
  const sessionCode = data?.code || (socket as any).data.joinCode;
  const requestingPlayerId = (socket as any).data.playerId;
  const targetPlayerId = data?.targetPlayerId;
  const eventId = data?.eventId as string | undefined;

  if (!sessionCode || !requestingPlayerId) {
    socket.emit('host-kick-player-error', { error: 'Not in a session' });
    if (ack) ack({ success: false, error: 'Not in a session' });
    return;
  }

  if (!targetPlayerId) {
    socket.emit('host-kick-player-error', { error: 'Target player ID is required' });
    if (ack) ack({ success: false, error: 'Target player ID is required' });
    return;
  }

  const session = getSession(sessionCode);
  if (!session) {
    socket.emit('host-kick-player-error', { error: 'Session not found' });
    if (ack) ack({ success: false, error: 'Session not found' });
    return;
  }

  if (isDuplicateEvent(`${sessionCode}:${requestingPlayerId}:host-kick-player:${targetPlayerId}`, eventId)) {
    if (ack) ack({ success: true, duplicate: true, session: session.toSnapshot(), targetPlayerId });
    return;
  }

  if (session.hostPlayerId !== requestingPlayerId) {
    socket.emit('host-kick-player-error', { error: 'Only host can remove players' });
    if (ack) ack({ success: false, error: 'Only host can remove players' });
    return;
  }

  if (targetPlayerId === requestingPlayerId) {
    socket.emit('host-kick-player-error', { error: 'Host cannot remove themselves' });
    if (ack) ack({ success: false, error: 'Host cannot remove themselves' });
    return;
  }

  const targetPlayer = session.getPlayer(targetPlayerId);
  if (!targetPlayer) {
    socket.emit('host-kick-player-error', { error: 'Target player not found in session' });
    if (ack) ack({ success: false, error: 'Target player not found in session' });
    return;
  }

  const targetSocketId = targetPlayer.currentSocketId;
  clearDisconnectTimer(sessionCode, targetPlayerId);

  if (targetSocketId) {
    io.to(targetSocketId).emit('player-kicked', {
      reason: 'host-kick',
      message: 'You were kicked by the host.',
      joinCode: sessionCode
    });

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.leave(sessionCode);
      (targetSocket as any).data.joinCode = undefined;
      (targetSocket as any).data.playerId = undefined;
    }
  }

  const updatedSession = removePlayerFromSession(sessionCode, targetPlayerId);

  if (!updatedSession) {
    socket.emit('host-kick-player-error', { error: 'Failed to remove player' });
    if (ack) ack({ success: false, error: 'Failed to remove player' });
    return;
  }

  io.to(sessionCode).emit('player-left', {
    playerId: targetPlayerId,
    players: updatedSession.players.map(p => p.toJSON())
  });

  io.to(sessionCode).emit('partyState', {
    players: updatedSession.players.map(p => p.toJSON()),
    gameStarted: updatedSession.started,
    phase: updatedSession.phase
  });

  io.to(sessionCode).emit('session-snapshot', {
    session: updatedSession.toSnapshot()
  });

  socket.emit('host-kick-player-success', {
    success: true,
    targetPlayerId,
    session: updatedSession.toSnapshot()
  });

  if (ack) {
    ack({
      success: true,
      targetPlayerId,
      session: updatedSession.toSnapshot()
    });
  }
}

export function handleLeaveSession(socket: Socket, io: Server, data: any) {
  const { code, role } = data || {};
  const sessionCode = code || (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;
  if (!sessionCode || !playerId) return;

  if (role === 'host') {
    io.to(sessionCode).emit('session-ended', {
      reason: 'host-left',
      message: 'The host left and ended the session.'
    });

    io.in(sessionCode).socketsLeave(sessionCode);
    endSession(sessionCode);
    socket.leave(sessionCode);
    (socket as any).data.joinCode = undefined;
    (socket as any).data.playerId = undefined;
    return;
  }

  const session = removePlayerFromSession(sessionCode, playerId);
  if (session) {
    if (session.hostPlayerId === playerId) {
      session.setHostPlayerId(null);
    }

    io.to(sessionCode).emit('player-left', {
      playerId: playerId,
      players: session.players.map(p => p.toJSON())
    });

    io.to(sessionCode).emit('partyState', {
      players: session.players.map(p => p.toJSON()),
      gameStarted: session.started,
      phase: session.phase
    });

    io.to(sessionCode).emit('session-snapshot', {
      session: session.toSnapshot()
    });

    console.log(`Player ${playerId} left session ${sessionCode}`);
  }

  socket.leave(sessionCode);
  (socket as any).data.joinCode = undefined;
  (socket as any).data.playerId = undefined;
}

export function handleDisconnect(socket: Socket, io: Server) {
  const joinCode = (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;

  if (joinCode && playerId) {
    const session = markPlayerDisconnected(joinCode, playerId);

    if (session) {
      io.to(joinCode).emit('player-connection-changed', {
        playerId: playerId,
        connectionState: 'disconnected',
        graceMs: DISCONNECT_GRACE_MS
      });

      io.to(joinCode).emit('partyState', {
        players: session.players.map(p => p.toJSON()),
        gameStarted: session.started,
        phase: session.phase
      });

      io.to(joinCode).emit('session-snapshot', {
        session: session.toSnapshot()
      });

      scheduleDisconnectExpiry(joinCode, playerId, ({ session: sessionAfterExpiry, wasHost, sessionEnded }) => {
        if (wasHost && sessionEnded) {
          io.to(joinCode).emit('session-ended', {
            reason: 'host-unavailable',
            message: 'Host unavailable for 60 seconds. Session ended.'
          });

          io.in(joinCode).socketsLeave(joinCode);
          return;
        }

        if (!sessionAfterExpiry) {
          return;
        }

        io.to(joinCode).emit('player-left', {
          playerId,
          players: sessionAfterExpiry.players.map(p => p.toJSON())
        });

        io.to(joinCode).emit('partyState', {
          players: sessionAfterExpiry.players.map(p => p.toJSON()),
          gameStarted: sessionAfterExpiry.started,
          phase: sessionAfterExpiry.phase
        });

        io.to(joinCode).emit('session-snapshot', {
          session: sessionAfterExpiry.toSnapshot()
        });
      });

      console.log(`Player ${playerId} disconnected from session ${joinCode} (grace ${DISCONNECT_GRACE_MS}ms)`);
    }
  }

  console.log('Client disconnected:', socket.id);
}
