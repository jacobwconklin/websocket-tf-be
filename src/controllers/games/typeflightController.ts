import Session from '../../models/Session';

/**
 * Initialize TypeFlight game state
 * @param session - The game session
 * @returns Initial game state
 */
export function initializeTypeFlight(session: Session): any {
  // TODO: Implement game-specific initialization
  return {};
}

/**
 * Update TypeFlight game state
 * @param session - The game session
 * @param playerId - The player making the update
 * @param data - Update data from the client
 * @returns Delta object containing only the changes to broadcast
 */
export function updateTypeFlight(session: Session, playerId: string, data: any): any {
  // Initialize game state if needed
  if (!session.gameState.typeflight) {
    session.gameState.typeflight = {
      playerPositions: {},
      playerScores: {},
      checkpoints: {},
      gameEnded: false,
      winner: null
    };
  }

  const gameState = session.gameState.typeflight;
  const delta: any = {
    gameType: 'typeflight',
    playerId: playerId
  };

  // Process the update based on data type
  if (data.type === 'position-update') {
    // Update player position
    gameState.playerPositions[playerId] = data.position;
    
    delta.type = 'position-update';
    delta.position = data.position;
  } else if (data.type === 'checkpoint') {
    // Player reached a checkpoint
    gameState.checkpoints[playerId] = (gameState.checkpoints[playerId] || 0) + 1;
    
    delta.type = 'checkpoint';
    delta.checkpointNumber = gameState.checkpoints[playerId];
    
    // Check win condition (example: first to reach checkpoint 10)
    if (gameState.checkpoints[playerId] >= 10 && !gameState.gameEnded) {
      gameState.gameEnded = true;
      gameState.winner = playerId;
      
      delta.gameEnded = true;
      delta.winner = playerId;
    }
  } else if (data.type === 'score-update') {
    // Update player score
    const oldScore = gameState.playerScores[playerId] || 0;
    gameState.playerScores[playerId] = data.score;
    
    delta.type = 'score-update';
    delta.score = data.score;
    delta.scoreChange = data.score - oldScore;
  }

  return delta;
}
