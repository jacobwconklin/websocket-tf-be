import Session from '../../models/Session';

// Initialize the games selection page (voting state)
export function initializeGames(session: Session): any {
  return {
    votes: {} // Structure: { quickkeys: ['playerId1', 'playerId2'], spacebarinvaders: [...] }
  };
}

// Update votes on the games page
export function updateGames(session: Session, playerId: string, data: any): any | null {
  if (data.type === 'vote') {
    const { gameName } = data;
    
    if (!session.gameState.votes) {
      session.gameState.votes = {};
    }
    
    const votes = session.gameState.votes;
    
    // Remove player's vote from all other games
    Object.keys(votes).forEach(game => {
      votes[game] = votes[game].filter((id: string) => id !== playerId);
    });
    
    // Toggle vote for the selected game
    if (!votes[gameName]) {
      votes[gameName] = [];
    }
    
    const playerIndex = votes[gameName].indexOf(playerId);
    if (playerIndex === -1) {
      // Add vote
      votes[gameName].push(playerId);
    } else {
      // Remove vote (toggle off)
      votes[gameName].splice(playerIndex, 1);
    }
    
    // Clean up empty vote arrays
    Object.keys(votes).forEach(game => {
      if (votes[game].length === 0) {
        delete votes[game];
      }
    });
    
    // Return delta with full votes state
    return {
      type: 'vote-update',
      votes: session.gameState.votes
    };
  }
  
  return null;
}
