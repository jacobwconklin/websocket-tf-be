import Session from '../../models/Session';

/**
 * Initialize QuickKeys game state
 * @param session - The game session
 * @returns Initial game state
 */
export function initializeQuickKeys(session: Session): any {
  // Initialize player positions for all players in session
  const playerPositions: Record<string, any> = {};
  session.players.forEach(player => {
    playerPositions[player.id] = {
      index: 0,
      time: null,
      errors: 0
    };
  });

  return {
    finished: false,
    textName: null,
    playerPositions: playerPositions
  };
}

/**
 * Update QuickKeys game state
 * @param session - The game session
 * @param playerId - The player making the update
 * @param data - Update data from the client
 * @returns Delta object containing only the changes to broadcast
 */
export function updateQuickKeys(session: Session, playerId: string, data: any): any {
  // Initialize game state if not already initialized
  if (!session.gameState.finished && !session.gameState.textName && !session.gameState.playerPositions) {
    session.gameState = {
      finished: false,
      textName: null,
      playerPositions: {}
    };
    session.players.forEach(player => {
      session.gameState.playerPositions[player.id] = {
        index: 0,
        time: null,
        errors: 0
      };
    });
  }

  const delta: any = {
    gameType: 'quickkeys',
    playerId: playerId
  };

  // Handle text selection
  if (data.type === 'text-selected') {
    session.gameState.textName = data.textId;
    
    delta.type = 'text-selected';
    delta.textName = data.textId;
    
    return delta;
  }

  // Handle word completion
  if (data.type === 'word-completed') {
    const playerPos = session.gameState.playerPositions[playerId];
    if (playerPos) {
      playerPos.index = data.index;
      playerPos.errors = data.errors || playerPos.errors;
    }

    delta.type = 'word-completed';
    delta.index = data.index;
    delta.errors = data.errors;
    
    return delta;
  }

  // Handle text completion
  if (data.type === 'text-completed') {
    const playerPos = session.gameState.playerPositions[playerId];
    if (playerPos) {
      playerPos.time = data.time;
      playerPos.errors = data.errors;
    }

    delta.type = 'text-completed';
    delta.time = data.time;
    delta.errors = data.errors;

    // Check if all players have finished
    const allFinished = Object.values(session.gameState.playerPositions).every(
      (pos: any) => pos.time !== null
    );

    if (allFinished) {
      session.gameState.finished = true;
      delta.finished = true;
    }

    return delta;
  }

  return delta;
}
