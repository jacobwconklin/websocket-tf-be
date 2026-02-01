import Session from '../../models/Session';

/**
 * Initialize TextSplosion game state
 * @param session - The game session
 * @returns Initial game state
 */
export function initializeTextSplosion(session: Session): any {
  // TODO: Implement game-specific initialization
  return {};
}

/**
 * Update TextSplosion game state
 * @param session - The game session
 * @param playerId - The player making the update
 * @param data - Update data from the client
 * @returns Delta object containing only the changes to broadcast
 */
export function updateTextSplosion(session: Session, playerId: string, data: any): any {
  // Initialize game state if needed
  if (!session.gameState.textsplosion) {
    session.gameState.textsplosion = {
      playerScores: {},
      wordsDestroyed: {},
      gameEnded: false,
      winner: null
    };
  }

  const gameState = session.gameState.textsplosion;
  const delta: any = {
    gameType: 'textsplosion',
    playerId: playerId
  };

  // Process the update based on data type
  if (data.type === 'word-destroyed') {
    // Update player score
    const oldScore = gameState.playerScores[playerId] || 0;
    const points = data.wordLength * 10; // Example scoring
    gameState.playerScores[playerId] = oldScore + points;
    
    // Track words destroyed
    gameState.wordsDestroyed[playerId] = (gameState.wordsDestroyed[playerId] || 0) + 1;
    
    delta.type = 'word-destroyed';
    delta.word = data.word;
    delta.score = gameState.playerScores[playerId];
    delta.scoreChange = points;
    delta.wordsDestroyed = gameState.wordsDestroyed[playerId];
  } else if (data.type === 'score-update') {
    // Direct score update
    const oldScore = gameState.playerScores[playerId] || 0;
    gameState.playerScores[playerId] = data.score;
    
    delta.type = 'score-update';
    delta.score = data.score;
    delta.scoreChange = data.score - oldScore;
  }

  // Check win condition (example: first to destroy 50 words)
  if (gameState.wordsDestroyed[playerId] >= 50 && !gameState.gameEnded) {
    gameState.gameEnded = true;
    gameState.winner = playerId;
    
    delta.gameEnded = true;
    delta.winner = playerId;
  }

  return delta;
}
