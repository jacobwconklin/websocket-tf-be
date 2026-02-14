import { Server, Socket } from 'socket.io';
import { updateGame, startGame } from '../controllers/gameStateController';
import { getSession } from '../controllers/sessionController';
import { startNextWave } from '../controllers/games/spacebarinvadersController';
import { startTypeFlightLoop, stopTypeFlightLoop } from '../controllers/games/typeflightController';

export function handleStartGame(socket: Socket, io: Server, data: any) {
    
  console.log("handleStartGame called with data:", data);

  const joinCode = (socket as any).data.joinCode;
  const playerId = (socket as any).data.playerId;

  if (!joinCode || !playerId) {
    socket.emit('start-error', { error: 'Not in a session' });
    return;
  }

  try {
    const { gameName } = data;
    const previousSession = getSession(joinCode);
    const previousGameName = previousSession?.gameName;
    
    console.log(`Starting game ${gameName || 'games'} for session ${joinCode} by player ${playerId}`);

    // Call the controller to start the game
    const session = startGame(joinCode, gameName);

    if (!session) {
      socket.emit('start-error', { error: 'Failed to start game' });
      return;
    }

    // Broadcast the full session to all players
    io.to(joinCode).emit('game-started', {
      success: true,
      session: session.toJSON()
    });

    // Manage authoritative TypeFlight loop ownership on game transitions.
    if (gameName === 'typeflight') {
      startTypeFlightLoop(session, io);
    } else if (previousGameName === 'typeflight') {
      stopTypeFlightLoop(joinCode);
    }

    console.log(`Game ${gameName || 'games'} started for session ${joinCode}`);
    
  } catch (error) {
    console.error('Error starting game:', error);
    socket.emit('start-error', { error: 'Internal error starting game' });
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
      session: session.toJSON(),
      playerId: playerId
    });

    console.log(`Game status sent to player ${playerId} in session ${joinCode}`);
    
  } catch (error) {
    console.error('Error getting game status:', error);
    socket.emit('game-status-error', { error: 'Internal error retrieving game status' });
  }
}
