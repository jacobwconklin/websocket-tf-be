import Session from '../../models/Session';
import { generateWordsForWave, generateSpawnPosition } from '../../utils/wordGenerator';

// Interface for a danger object
interface Danger {
  id: string;
  word: string;
  x: number;
  y: number;
}

/**
 * Calculate the number of dangers for a given wave
 * @param waveNumber - Current wave number
 * @param playerCount - Number of players in the session
 * @returns Number of dangers to spawn
 */
function getDangersForWave(waveNumber: number, playerCount: number): number {
  // Wave 1: 5 + (1 * playerCount)
  // Waves 2-4: 5 + (3 * playerCount)
  // Wave 5+: previous wave count + (2 * playerCount)
  
  let dangerTotal = 5 + (1 * playerCount)
  if (waveNumber === 1) return dangerTotal;
  // Add wave 2-4 increment of 3 x playercount
  dangerTotal += 3 * playerCount; 
  if (waveNumber === 2) return dangerTotal;
  dangerTotal += 3 * playerCount; 
  if (waveNumber === 3) return dangerTotal;
  dangerTotal += 3 * playerCount; 
  if (waveNumber === 4) return dangerTotal;
  
  // loop adding 2 * playercount for each wave after 4 until wavenumber reached
  for (let wave = 5; wave <= waveNumber; wave++) {
    dangerTotal += 2 * playerCount;
  }
  
  if (waveNumber >= 2 && waveNumber <= 4) {
    return 5 + (3 * playerCount);
  }
  
  return dangerTotal;
}

/**
 * Initialize a new wave with dangers
 * @param waveNumber - Wave number to initialize
 * @param playerCount - Number of players in the session
 * @returns Array of danger objects
 */
function initializeWave(waveNumber: number, playerCount: number): Danger[] {
  const dangerCount = getDangersForWave(waveNumber, playerCount);
  const words = generateWordsForWave(dangerCount);
  
  const dangers: Danger[] = words.map((word, index) => {
    const position = generateSpawnPosition(waveNumber);
    return {
      id: `danger-${waveNumber}-${index}-${Date.now()}`,
      word,
      x: position.x,
      y: position.y
    };
  });
  
  return dangers;
}

/**
 * Initialize SpaceBarInvaders game state
 * @param session - The game session
 * @returns Initial game state
 */
export function initializeSpaceBarInvaders(session: Session): any {
  // Initialize wave 1
  const playerCount = session.players.length || 1; // Default to 1 for solo
  const dangers = initializeWave(1, playerCount);
  
  // Initialize player stats
  const playerStats: Record<string, number> = {};
  session.players.forEach(player => {
    playerStats[player.id] = 0; // Dangers destroyed count
  });
  
  return {
    waveNumber: 1,
    earthHits: 0,
    dangers: dangers,
    gameOver: false,
    waveTransitioning: false,
    gameStartTime: Date.now(),
    playerStats: playerStats,
    survivalTime: 0
  };
}

/**
 * Update SpaceBarInvaders game state
 * @param session - The game session
 * @param playerId - The player making the update
 * @param data - Update data from the client
 * @returns Delta object containing only the changes to broadcast
 */
export function updateSpaceBarInvaders(session: Session, playerId: string, data: any): any {
  const delta: any = {
    gameType: 'spacebarinvaders',
    playerId: playerId
  };

  // Handle word destroyed event
  if (data.type === 'word-destroyed') {
    const { word } = data;
    
    // Find and remove the danger with this word
    const dangerIndex = session.gameState.dangers.findIndex((d: Danger) => d.word === word);
    
    if (dangerIndex !== -1) {
      const removedDanger = session.gameState.dangers[dangerIndex];
      session.gameState.dangers.splice(dangerIndex, 1);
      
      // Increment player's danger destroyed count
      if (!session.gameState.playerStats[playerId]) {
        session.gameState.playerStats[playerId] = 0;
      }
      session.gameState.playerStats[playerId] += 1;
      
      delta.type = 'word-destroyed';
      delta.word = word;
      delta.dangerId = removedDanger.id;
      delta.playerStats = session.gameState.playerStats;
      
      // Check if wave is complete (no more dangers)
      if (session.gameState.dangers.length === 0 && !session.gameState.gameOver && !session.gameState.waveTransitioning) {
        // Mark wave as transitioning to prevent multiple triggers
        session.gameState.waveTransitioning = true;
        
        delta.waveComplete = true;
        delta.currentWaveNumber = session.gameState.waveNumber;
        
        // Note: The new wave will be spawned after a 5-second delay
        // This is handled by a separate mechanism (event or timer)
        // For now, we just signal wave completion
      }
    } else {
      // Word not found in dangers list
      delta.type = 'word-not-found';
      delta.word = word;
    }
  }
  
  // Handle earth hit event (only from host/solo player)
  else if (data.type === 'earth-hit') {
    const { dangerId } = data;
    
    // Increment earth hits
    session.gameState.earthHits += 1;
    
    // Remove the danger that hit earth
    const dangerIndex = session.gameState.dangers.findIndex((d: Danger) => d.id === dangerId);
    if (dangerIndex !== -1) {
      session.gameState.dangers.splice(dangerIndex, 1);
    }
    
    delta.type = 'earth-hit';
    delta.earthHits = session.gameState.earthHits;
    delta.dangerId = dangerId;
    
    // Check for game over (3 hits)
    if (session.gameState.earthHits >= 3) {
      session.gameState.gameOver = true;
      
      // Calculate survival time
      const survivalTime = Date.now() - session.gameState.gameStartTime;
      session.gameState.survivalTime = survivalTime;
      
      delta.gameOver = true;
      delta.finalWave = session.gameState.waveNumber;
      delta.survivalTime = survivalTime;
      delta.playerStats = session.gameState.playerStats;
    }
    // Check if wave is complete (no more dangers and game not over)
    else if (session.gameState.dangers.length === 0 && !session.gameState.gameOver && !session.gameState.waveTransitioning) {
      // Mark wave as transitioning to prevent multiple triggers
      session.gameState.waveTransitioning = true;
      
      delta.waveComplete = true;
      delta.currentWaveNumber = session.gameState.waveNumber;
      
      // Note: The new wave will be spawned after a 5-second delay
      // This is handled in the gameStateRouter
    }
  }

  return delta;
}

/**
 * Start the next wave (called after delay)
 * @param session - The game session
 * @returns Delta object for the new wave
 */
export function startNextWave(session: Session): any | null {
  if (!session.gameState.waveTransitioning) {
    return null;
  }
  
  // Increment wave number
  session.gameState.waveNumber += 1;
  
  // Generate new dangers
  const playerCount = session.players.length || 1;
  const newDangers = initializeWave(session.gameState.waveNumber, playerCount);
  session.gameState.dangers = newDangers;
  
  // Reset transitioning flag
  session.gameState.waveTransitioning = false;
  
  return {
    type: 'wave-started',
    gameType: 'spacebarinvaders',
    waveNumber: session.gameState.waveNumber,
    dangers: newDangers
  };
}
