import Session from '../../models/Session';

// Calculate words needed until pop based on player count
const calculateWordsUntilPop = (playerCount: number) => {
  return playerCount * 20 + Math.floor(Math.random() * 10) + 1;
};

/**
 * Initialize TextSplosion game state
 * @param session - The game session
 * @returns Initial game state
 */
export function initializeTextSplosion(session: Session): any {
  const playerIds = session.players.map(p => p.id);
  const initialWordsTyped: Record<string, number> = {};
  
  session.players.forEach(player => {
    initialWordsTyped[player.id] = 0;
  });

  return {
    playerOrder: playerIds,
    expiredPlayers: [],
    wordsTyped: initialWordsTyped,
    numWordsUntilPop: calculateWordsUntilPop(session.players.length),
    numWordsPumped: 0,
    finished: false,
    winnerId: null
  };
}


/**
 * Update TextSplosion game state
 * @param session - The game session
 * @param playerId - The player making the update
 * @param data - Update data from the client
 * @returns Delta object containing only the changes to broadcast
 */
export function updateTextSplosion(session: Session, playerId: string, data: any): any {
  // Initialize game state if not already initialized
  if (!session.gameState.playerOrder || session.gameState.playerOrder.length === 0) {
    session.gameState = initializeTextSplosion(session);
  }

  const delta: any = {
    gameType: 'textsplosion',
    playerId: playerId
  };

  // Handle word completion (pumping)
  if (data.type === 'word-completed') {
    // Increment pump counter
    session.gameState.numWordsPumped = (session.gameState.numWordsPumped || 0) + 1;
    
    if (session.gameState.wordsTyped) {
      session.gameState.wordsTyped[playerId] = data.totalWords;
    }

    delta.type = 'word-completed';
    delta.totalWords = data.totalWords;
    delta.numWordsPumped = session.gameState.numWordsPumped;

    // Check if balloon should pop
    if (session.gameState.numWordsPumped >= session.gameState.numWordsUntilPop) {
      // Balloon pops! Expire hot seat player
      const expiredPlayerId = session.gameState.playerOrder[0];
      
      // Remove expired player from playerOrder and add to expiredPlayers
      session.gameState.playerOrder = session.gameState.playerOrder.filter(
        (id: string) => id !== expiredPlayerId
      );
      
      if (!session.gameState.expiredPlayers) {
        session.gameState.expiredPlayers = [];
      }
      session.gameState.expiredPlayers.push(expiredPlayerId);

      // Check for winner - game ends when only 1 player remains in playerOrder
      if (session.gameState.playerOrder.length === 1) {
        session.gameState.finished = true;
        session.gameState.winnerId = session.gameState.playerOrder[0];
        
        delta.type = 'player-expired';
        delta.expiredPlayerId = expiredPlayerId;
        delta.finished = true;
        delta.winnerId = session.gameState.winnerId;
        delta.playerOrder = session.gameState.playerOrder;
        delta.expiredPlayers = session.gameState.expiredPlayers;
        
        return delta;
      }

      // Reset for next round
      session.gameState.numWordsPumped = 0;
      session.gameState.numWordsUntilPop = calculateWordsUntilPop(session.gameState.playerOrder.length);

      delta.type = 'player-expired';
      delta.expiredPlayerId = expiredPlayerId;
      delta.playerOrder = session.gameState.playerOrder;
      delta.expiredPlayers = session.gameState.expiredPlayers;
      delta.numWordsPumped = session.gameState.numWordsPumped;
      delta.numWordsUntilPop = session.gameState.numWordsUntilPop;
    }

    return delta;
  }

  // Handle challenge completion
  if (data.type === 'challenge-completed') {
    // Move hot seat player (first in order) to back
    const hotSeatPlayer = session.gameState.playerOrder.shift();
    session.gameState.playerOrder.push(hotSeatPlayer);

    delta.type = 'challenge-completed';
    delta.playerOrder = session.gameState.playerOrder;
    delta.numWordsPumped = session.gameState.numWordsPumped;

    return delta;
  }

  return delta;
}
