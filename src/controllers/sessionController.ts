import Session from '../models/Session';
import Player from '../models/Player';
import { generateJoinCode } from '../utils/codeGenerator';

const sessions: Map<string, Session> = new Map();

export function createSession(gameName: string | null = null): Session {
  let joinCode: string;
  do {
    joinCode = generateJoinCode();
  } while (sessions.has(joinCode));

  const session = new Session(joinCode, gameName);
  sessions.set(joinCode, session);
  return session;
}

export function getSession(joinCode: string): Session | undefined {
  return sessions.get(joinCode);
}

export function addPlayerToSession(joinCode: string, player: Player): Session | null {
  const session = sessions.get(joinCode);
  if (!session) {
    return null;
  }
  session.addPlayer(player);
  return session;
}

export function removePlayerFromSession(joinCode: string, playerId: string): Session | null {
  const session = sessions.get(joinCode);
  if (!session) {
    return null;
  }
  session.removePlayer(playerId);

  if (session.players.length === 0) {
    sessions.delete(joinCode);
  }

  return session;
}
