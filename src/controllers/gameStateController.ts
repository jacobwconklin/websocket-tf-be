import { getSession } from './sessionController';
import Session from '../models/Session';
import { initializeQuickKeys, updateQuickKeys } from './games/quickkeysController';
import { initializeSpaceBarInvaders, updateSpaceBarInvaders } from './games/spacebarinvadersController';
import { initializeTextSplosion, updateTextSplosion } from './games/textsplosionController';
import { initializeTypeFlight, updateTypeFlight } from './games/typeflightController';
import { initializeGames, updateGames } from './games/gamesController';

export function startGame(joinCode: string, gameName: string): Session | null {
  const session = getSession(joinCode);
  
  if (!session) {
    console.error(`Session ${joinCode} not found`);
    return null;
  }

  // Set the game name
  session.gameName = gameName;

  // Initialize game state based on game name
  let gameState = {};

  switch (gameName) {
    case 'quickkeys':
      gameState = initializeQuickKeys(session);
      break;
    case 'spacebarinvaders':
      gameState = initializeSpaceBarInvaders(session);
      break;
    case 'textsplosion':
      gameState = initializeTextSplosion(session);
      break;
    case 'typeflight':
      gameState = initializeTypeFlight(session);
    case 'games':
      // Game selection page with voting
      gameState = initializeGames(session);
      console.log(`Setting session ${joinCode} to games page with voting`);
      break;
    default:
      // Unknown game - set to games page
      session.gameName = 'games';
      gameState = initializeGames(session);
      console.log(`Setting session ${joinCode} to games page`);
  }

  session.gameState = gameState;
  session.started = true;

  return session;
}

export function updateGame(joinCode: string, playerId: string, data: any): any | null {
  const session = getSession(joinCode);
  
  if (!session) {
    console.error(`Session ${joinCode} not found`);
    return null;
  }

  if (!session.started) {
    console.error(`Game in session ${joinCode} has not started`);
    return null;
  }

  // Route to the appropriate game controller based on gameName
  let delta = null;

  switch (session.gameName) {
    case 'quickkeys':
      delta = updateQuickKeys(session, playerId, data);
      break;
    case 'spacebarinvaders':
      delta = updateSpaceBarInvaders(session, playerId, data);
      break;
    case 'textsplosion':
      delta = updateTextSplosion(session, playerId, data);
      break;
    case 'typeflight':
      delta = updateTypeFlight(session, playerId, data);
      break;
    case 'games':
      // Handle voting on games selection page
      delta = updateGames(session, playerId, data);
      break;
    default:
      console.error(`Unknown game: ${session.gameName}`);
      return null;
  }

  return delta;
}
