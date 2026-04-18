import Session from '../models/Session';
import Player from '../models/Player';
import { generateJoinCode } from '../utils/codeGenerator';
import { stopTypeFlightLoop } from './games/typeflightController';
import { stopTypekwandoLoop } from './games/typekwandoController';

const sessions: Map<string, Session> = new Map();
const disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

export const DISCONNECT_GRACE_MS = 60_000;

function playerKey(joinCode: string, playerId: string): string {
  return `${joinCode}:${playerId}`;
}

export function clearDisconnectTimer(joinCode: string, playerId: string): void {
  const key = playerKey(joinCode, playerId);
  const timer = disconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(key);
  }
}

export function scheduleDisconnectExpiry(
  joinCode: string,
  playerId: string,
  onExpire: (payload: { joinCode: string; playerId: string; wasHost: boolean; session: Session | null; sessionEnded: boolean }) => void
): void {
  clearDisconnectTimer(joinCode, playerId);
  const key = playerKey(joinCode, playerId);

  const timer = setTimeout(() => {
    disconnectTimers.delete(key);
    const session = getSession(joinCode);
    if (!session) return;

    const player = session.getPlayer(playerId);
    if (!player || player.connectionState !== 'disconnected') return;

    const wasHost = session.hostPlayerId === playerId;
    if (wasHost) {
      endSession(joinCode);
      onExpire({ joinCode, playerId, wasHost: true, session: null, sessionEnded: true });
      return;
    }

    const updatedSession = removePlayerFromSession(joinCode, playerId);
    onExpire({ joinCode, playerId, wasHost: false, session: updatedSession, sessionEnded: false });
  }, DISCONNECT_GRACE_MS);

  disconnectTimers.set(key, timer);
}

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

export function markPlayerConnected(joinCode: string, playerId: string, socketId: string): Session | null {
  const session = sessions.get(joinCode);
  if (!session) return null;

  clearDisconnectTimer(joinCode, playerId);
  const player = session.getPlayer(playerId);
  if (!player) return null;

  session.markPlayerConnected(playerId, socketId);
  return session;
}

export function markPlayerDisconnected(joinCode: string, playerId: string): Session | null {
  const session = sessions.get(joinCode);
  if (!session) return null;

  const player = session.getPlayer(playerId);
  if (!player) return null;

  session.markPlayerDisconnected(playerId);
  return session;
}

export function removePlayerFromSession(joinCode: string, playerId: string): Session | null {
  const session = sessions.get(joinCode);
  if (!session) {
    return null;
  }
  session.removePlayer(playerId);

  if (session.players.length === 0) {
    stopTypeFlightLoop(joinCode);
    stopTypekwandoLoop(joinCode);
    sessions.delete(joinCode);
  }

  return session;
}

export function endSession(joinCode: string): boolean {
  const session = sessions.get(joinCode);
  if (!session) {
    return false;
  }

  stopTypeFlightLoop(joinCode);
  stopTypekwandoLoop(joinCode);
  sessions.delete(joinCode);
  return true;
}
