import Session from '../../models/Session';

/**
 * Initialize SpaceBarInvaders game state
 * @param session - The game session
 * @returns Initial game state
 */
export function initializeSpaceBarInvaders(session: Session): any {
  // TODO: Implement game-specific initialization
  return {};
}

/**
 * Update SpaceBarInvaders game state
 * @param session - The game session
 * @param playerId - The player making the update
 * @param data - Update data from the client
 * @returns Delta object containing only the changes to broadcast
 */
export function updateSpaceBarInvaders(session: Session, playerId: string, data: any): any {
  // Initialize game state if needed
  if (!session.gameState.spacebarinvaders) {
    session.gameState.spacebarinvaders = {
      playerScores: {},
      lives: {},
      gameEnded: false,
      winner: null
    };
  }

  const gameState = session.gameState.spacebarinvaders;
  const delta: any = {
    gameType: 'spacebarinvaders',
    playerId: playerId
  };

  // Process the update based on data type
  if (data.type === 'score-update') {
    // Update player score
    const oldScore = gameState.playerScores[playerId] || 0;
    gameState.playerScores[playerId] = data.score;
    
    delta.type = 'score-update';
    delta.score = data.score;
    delta.scoreChange = data.score - oldScore;
  } else if (data.type === 'lives-update') {
    // Update player lives
    gameState.lives[playerId] = data.lives;
    
    delta.type = 'lives-update';
    delta.lives = data.lives;

    // Check if player is eliminated
    if (data.lives <= 0) {
      delta.eliminated = true;
      
      // Check if all other players are also eliminated
      const activePlayers = Object.entries(gameState.lives).filter(([_, lives]) => (lives as number) > 0);
      if (activePlayers.length === 1 && !gameState.gameEnded) {
        gameState.gameEnded = true;
        gameState.winner = activePlayers[0][0];
        
        delta.gameEnded = true;
        delta.winner = gameState.winner;
      }
    }
  }

  return delta;
}
