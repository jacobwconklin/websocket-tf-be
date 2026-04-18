import { Server, Socket } from 'socket.io';
import { updateGame, startGame, returnToLobby } from '../controllers/gameStateController';
import { getSession } from '../controllers/sessionController';
import { startNextWave } from '../controllers/games/spacebarinvadersController';
import { startTypeFlightLoop, stopTypeFlightLoop } from '../controllers/games/typeflightController';
import { startTypekwandoLoop, stopTypekwandoLoop } from '../controllers/games/typekwandoController';
import { isDuplicateEvent } from '../utils/idempotency';

export function handleStartGame(socket: Socket, io: Server, data: any, ack?: (payload: any) => void) {
    
  console.log("handleStartGame called with data:", data);

  const joinCode = (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;
  const eventId = data?.eventId as string | undefined;

  if (!joinCode || !playerId) {
    socket.emit('start-error', { error: 'Not in a session' });
    if (ack) ack({ success: false, error: 'Not in a session' });
    return;
  }

  try {
    const { gameName } = data;
    const previousSession = getSession(joinCode);
    const previousGameName = previousSession?.gameName;

    if (isDuplicateEvent(`${joinCode}:${playerId}:start-game`, eventId) && previousSession) {
      if (ack) ack({ success: true, duplicate: true, session: previousSession.toSnapshot() });
      return;
    }
    
    console.log(`Starting game ${gameName || 'games'} for session ${joinCode} by player ${playerId}`);

    // Call the controller to start the game
    const session = startGame(joinCode, gameName);

    if (!session) {
      socket.emit('start-error', { error: 'Failed to start game' });
      if (ack) ack({ success: false, error: 'Failed to start game' });
      return;
    }

    // Broadcast the full session to all players
    io.to(joinCode).emit('game-started', {
      success: true,
      session: session.toSnapshot()
    });

    io.to(joinCode).emit('session-phase-changed', {
      phase: session.phase,
      gameName: session.gameName
    });

    io.to(joinCode).emit('session-snapshot', {
      session: session.toSnapshot()
    });

    // Manage authoritative TypeFlight loop ownership on game transitions.
    if (previousGameName === 'typeflight' && gameName !== 'typeflight') {
      stopTypeFlightLoop(joinCode);
    }

    if (gameName === 'typekwando') {
      startTypekwandoLoop(session, io);
    } else if (previousGameName === 'typekwando') {
      stopTypekwandoLoop(joinCode);
    }

    console.log(`Game ${gameName || 'games'} started for session ${joinCode}`);
    if (ack) ack({ success: true, session: session.toSnapshot() });
    
  } catch (error) {
    console.error('Error starting game:', error);
    socket.emit('start-error', { error: 'Internal error starting game' });
    if (ack) ack({ success: false, error: 'Internal error starting game' });
  }
}

export function handleUpdateGame(socket: Socket, io: Server, data: any) {
  const joinCode = (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;

  if (!joinCode || !playerId) {
    socket.emit('update-error', { error: 'Not in a session' });
    return;
  }

  try {
    // Call the controller to process the update
    const delta = updateGame(joinCode, playerId, data);

    if (!delta) {
      socket.emit('update-error', { error: 'Failed to update game state' });
      return;
    }

    // Broadcast the delta to all players in the session
    io.to(joinCode).emit('game-update', delta);

    if (delta.gameType === 'typeflight' && delta.type === 'typeflight-begin') {
      const session = getSession(joinCode);
      if (session) {
        startTypeFlightLoop(session, io);
      }
    }
    
    // Handle wave completion with 5-second delay for SpaceBarInvaders
    if (delta.waveComplete && delta.gameType === 'spacebarinvaders') {
      setTimeout(() => {
        const session = getSession(joinCode);
        if (session) {
          const waveDelta = startNextWave(session);
          if (waveDelta) {
            io.to(joinCode).emit('game-update', waveDelta);
          }
        }
      }, 5000); // 5 second delay
    }
    
  } catch (error) {
    console.error('Error updating game:', error);
    socket.emit('update-error', { error: 'Internal error updating game' });
  }
}

export function handleGameStatus(socket: Socket, io: Server, data: any) {
  const joinCode = (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;

  if (!joinCode || !playerId) {
    socket.emit('game-status-error', { error: 'Not in a session' });
    return;
  }

  try {
    const session = getSession(joinCode);

    if (!session) {
      socket.emit('game-status-error', { error: 'Session not found' });
      return;
    }

    // Send the complete session data back to the requesting client
    socket.emit('game-status', {
      success: true,
      session: session.toSnapshot(),
      playerId: playerId
    });

    console.log(`Game status sent to player ${playerId} in session ${joinCode}`);
    
  } catch (error) {
    console.error('Error getting game status:', error);
    socket.emit('game-status-error', { error: 'Internal error retrieving game status' });
  }
}

export function handleHostReturnToLobby(socket: Socket, io: Server, data: any, ack?: (payload: any) => void) {
  const joinCode = (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;
  const eventId = data?.eventId as string | undefined;

  if (!joinCode || !playerId) {
    socket.emit('host-return-to-lobby-error', { error: 'Not in a session' });
    if (ack) ack({ success: false, error: 'Not in a session' });
    return;
  }

  const sessionBefore = getSession(joinCode);
  if (!sessionBefore) {
    socket.emit('host-return-to-lobby-error', { error: 'Session not found' });
    if (ack) ack({ success: false, error: 'Session not found' });
    return;
  }

  if (isDuplicateEvent(`${joinCode}:${playerId}:host-return-to-lobby`, eventId)) {
    if (ack) ack({ success: true, duplicate: true, session: sessionBefore.toSnapshot() });
    return;
  }

  if (sessionBefore.hostPlayerId && sessionBefore.hostPlayerId !== playerId) {
    socket.emit('host-return-to-lobby-error', { error: 'Only host can return party to lobby' });
    if (ack) ack({ success: false, error: 'Only host can return party to lobby' });
    return;
  }

  if (sessionBefore.gameName === 'typeflight') {
    stopTypeFlightLoop(joinCode);
  }
  if (sessionBefore.gameName === 'typekwando') {
    stopTypekwandoLoop(joinCode);
  }

  const session = returnToLobby(joinCode);
  if (!session) {
    socket.emit('host-return-to-lobby-error', { error: 'Failed to return to lobby' });
    if (ack) ack({ success: false, error: 'Failed to return to lobby' });
    return;
  }

  io.to(joinCode).emit('session-phase-changed', {
    phase: session.phase,
    gameName: session.gameName
  });

  io.to(joinCode).emit('session-snapshot', {
    session: session.toSnapshot()
  });

  io.to(joinCode).emit('partyState', {
    players: session.players.map(p => p.toJSON()),
    gameStarted: session.started,
    phase: session.phase
  });

  io.to(joinCode).emit('returned-to-lobby', {
    success: true,
    session: session.toSnapshot()
  });

  if (ack) ack({ success: true, session: session.toSnapshot() });
}
