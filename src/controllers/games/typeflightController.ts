import Session from '../../models/Session';
import type { Server } from 'socket.io';

const GRID_SIZE = 10;
const EVENT_TYPES = ['fire', 'ice', 'lightning', 'bomb', 'laser', 'spikes'] as const;

const CASUAL_GAME_LENGTH_MS = 60 * 1000;
const INTENSE_GAME_LENGTH_MS = 45 * 1000;
const START_WARNING_DURATION_MS = 2500;
const CASUAL_END_WARNING_DURATION_MS = 1500;
const START_EVENT_INTERVAL_MS = 2500;
const CASUAL_END_EVENT_INTERVAL_MS = 1000;
const MAX_WARNING_DURATION_MS = 500;
const MAX_EVENT_PAIR_INTERVAL_MS = 500;
const CASUAL_EVENTS_PER_SPAWN = 3;
const INTENSE_EVENTS_PER_SPAWN = 4;
const MAX_EVENTS_PER_SPAWN = 5;

type EventType = (typeof EVENT_TYPES)[number];
type Direction = 'up' | 'right' | 'down' | 'left';

interface GridPosition {
  x: number;
  y: number;
}

interface TypeFlightPlayerState extends GridPosition {
  alive: boolean;
}

interface TypeFlightEvent {
  id: string;
  type: EventType;
  position: GridPosition;
  createdAt: number;
}

interface TypeFlightState {
  gameType: 'typeflight';
  startedAt: number;
  endedAt: number | null;
  elapsedMs: number;
  gameOver: boolean;
  players: Record<string, TypeFlightPlayerState>;
  playerDeaths: Record<string, number>;
  wordsTyped: Record<string, number>;
  eventCounts: Record<EventType, number>;
  events: TypeFlightEvent[];
}

type LoopState = {
  timer: NodeJS.Timeout;
  io: Server;
};

const loops: Map<string, LoopState> = new Map();

function clampCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(value)));
}

function wrapCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((Math.floor(value) % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
}

function normalizePosition(position: Partial<GridPosition>): GridPosition {
  return {
    x: clampCoordinate(Number(position.x ?? 0)),
    y: clampCoordinate(Number(position.y ?? 0))
  };
}

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function randomPosition(): GridPosition {
  return { x: randomInt(GRID_SIZE), y: randomInt(GRID_SIZE) };
}

function randomUniquePosition(usedKeys: Set<string>): GridPosition {
  let pos = randomPosition();
  let key = `${pos.x},${pos.y}`;
  let tries = 0;

  while (usedKeys.has(key) && tries < GRID_SIZE * GRID_SIZE) {
    pos = randomPosition();
    key = `${pos.x},${pos.y}`;
    tries += 1;
  }

  usedKeys.add(key);
  return pos;
}

function randomEventType(): EventType {
  return EVENT_TYPES[randomInt(EVENT_TYPES.length)];
}

function emptyEventCounts(): Record<EventType, number> {
  return {
    fire: 0,
    ice: 0,
    lightning: 0,
    bomb: 0,
    laser: 0,
    spikes: 0
  };
}

function buildInitialPlayerMap(session: Session): Record<string, TypeFlightPlayerState> {
  const used = new Set<string>();
  const players: Record<string, TypeFlightPlayerState> = {};

  for (const player of session.players) {
    let pos = randomPosition();
    let key = `${pos.x},${pos.y}`;

    // Keep initial positions unique while possible.
    let tries = 0;
    while (used.has(key) && tries < GRID_SIZE * GRID_SIZE) {
      pos = randomPosition();
      key = `${pos.x},${pos.y}`;
      tries += 1;
    }

    used.add(key);
    players[player.id] = {
      x: pos.x,
      y: pos.y,
      alive: true
    };
  }

  return players;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function calculateSpawnSettings(elapsedMs: number): { intervalMs: number; eventsPerSpawn: number } {
  if (elapsedMs <= CASUAL_GAME_LENGTH_MS) {
    const t = clamp01(elapsedMs / CASUAL_GAME_LENGTH_MS);
    return {
      intervalMs: Math.round(lerp(START_EVENT_INTERVAL_MS, CASUAL_END_EVENT_INTERVAL_MS, t)),
      eventsPerSpawn: CASUAL_EVENTS_PER_SPAWN
    };
  }

  const intenseElapsed = elapsedMs - CASUAL_GAME_LENGTH_MS;
  if (intenseElapsed <= INTENSE_GAME_LENGTH_MS) {
    const t = clamp01(intenseElapsed / INTENSE_GAME_LENGTH_MS);
    return {
      intervalMs: Math.round(lerp(CASUAL_END_EVENT_INTERVAL_MS, MAX_EVENT_PAIR_INTERVAL_MS, t)),
      eventsPerSpawn: INTENSE_EVENTS_PER_SPAWN
    };
  }

  return {
    intervalMs: MAX_EVENT_PAIR_INTERVAL_MS,
    eventsPerSpawn: MAX_EVENTS_PER_SPAWN
  };
}

function getTypeFlightState(session: Session): TypeFlightState {
  return session.gameState as TypeFlightState;
}

function scheduleNextEvent(joinCode: string, session: Session) {
  const loop = loops.get(joinCode);
  if (!loop) return;

  const state = getTypeFlightState(session);
  if (state.gameOver) {
    stopTypeFlightLoop(joinCode);
    return;
  }

  const elapsedMs = Date.now() - state.startedAt;
  const { intervalMs, eventsPerSpawn } = calculateSpawnSettings(elapsedMs);

  loop.timer = setTimeout(() => {
    const currentLoop = loops.get(joinCode);
    if (!currentLoop) return;

    const currentState = getTypeFlightState(session);
    if (currentState.gameOver) {
      stopTypeFlightLoop(joinCode);
      return;
    }

    currentState.elapsedMs = Date.now() - currentState.startedAt;

    const usedKeys = new Set<string>();
    for (let i = 0; i < eventsPerSpawn; i += 1) {
      const eventType = randomEventType();
      const event: TypeFlightEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: eventType,
        position: randomUniquePosition(usedKeys),
        createdAt: Date.now()
      };

      currentState.eventCounts[eventType] = (currentState.eventCounts[eventType] ?? 0) + 1;
      currentState.events.push(event);

      currentLoop.io.to(joinCode).emit('game-update', {
        gameType: 'typeflight',
        type: 'event-spawned',
        event,
        elapsedMs: currentState.elapsedMs,
        eventCounts: currentState.eventCounts
      });
    }

    // Keep payload bounded.
    if (currentState.events.length > 100) {
      currentState.events = currentState.events.slice(-100);
    }

    scheduleNextEvent(joinCode, session);
  }, intervalMs);
}

function checkAndHandleGameOver(session: Session): boolean {
  const state = getTypeFlightState(session);
  const playerStates = Object.values(state.players);
  if (playerStates.length === 0) return false;

  const allDead = playerStates.every((p) => !p.alive);
  if (!allDead || state.gameOver) return false;

  state.gameOver = true;
  state.endedAt = Date.now();
  state.elapsedMs = state.endedAt - state.startedAt;
  stopTypeFlightLoop(session.joinCode);
  return true;
}

function moveWithWrap(position: GridPosition, direction: Direction): GridPosition {
  switch (direction) {
    case 'up':
      return { x: position.x, y: wrapCoordinate(position.y - 1) };
    case 'right':
      return { x: wrapCoordinate(position.x + 1), y: position.y };
    case 'down':
      return { x: position.x, y: wrapCoordinate(position.y + 1) };
    case 'left':
      return { x: wrapCoordinate(position.x - 1), y: position.y };
    default:
      return position;
  }
}

/**
 * Initialize TypeFlight game state
 * @param session - The game session
 * @returns Initial game state
 */
export function initializeTypeFlight(session: Session): any {
  const startedAt = Date.now();
  const players = buildInitialPlayerMap(session);
  const playerDeaths: Record<string, number> = {};
  const wordsTyped: Record<string, number> = {};

  session.players.forEach((player) => {
    playerDeaths[player.id] = 0;
    wordsTyped[player.id] = 0;
  });

  return {
    gameType: 'typeflight',
    startedAt,
    endedAt: null,
    elapsedMs: 0,
    gameOver: false,
    players,
    playerDeaths,
    wordsTyped,
    eventCounts: emptyEventCounts(),
    events: []
  };
}

export function startTypeFlightLoop(session: Session, io: Server) {
  if (session.gameName !== 'typeflight') return;

  stopTypeFlightLoop(session.joinCode);
  loops.set(session.joinCode, {
    io,
    timer: setTimeout(() => undefined, 0)
  });
  scheduleNextEvent(session.joinCode, session);
}

export function stopTypeFlightLoop(joinCode: string) {
  const loop = loops.get(joinCode);
  if (!loop) return;

  clearTimeout(loop.timer);
  loops.delete(joinCode);
}

/**
 * Update TypeFlight game state
 * @param session - The game session
 * @param playerId - The player making the update
 * @param data - Update data from the client
 * @returns Delta object containing only the changes to broadcast
 */
export function updateTypeFlight(session: Session, playerId: string, data: any): any {
  // Backstop initialization.
  if (!session.gameState || session.gameState.gameType !== 'typeflight') {
    session.gameState = initializeTypeFlight(session);
  }

  const gameState = getTypeFlightState(session);
  gameState.elapsedMs = Date.now() - gameState.startedAt;

  // Make sure this player exists in game state.
  if (!gameState.players[playerId]) {
    gameState.players[playerId] = {
      ...randomPosition(),
      alive: true
    };
  }
  if (typeof gameState.playerDeaths[playerId] !== 'number') {
    gameState.playerDeaths[playerId] = 0;
  }
  if (!gameState.wordsTyped) {
    gameState.wordsTyped = {};
  }
  if (typeof gameState.wordsTyped[playerId] !== 'number') {
    gameState.wordsTyped[playerId] = 0;
  }

  const delta: any = {
    gameType: 'typeflight',
    playerId: playerId,
    elapsedMs: gameState.elapsedMs
  };

  if (gameState.gameOver) {
    delta.type = 'game-over';
    delta.gameOver = true;
    delta.elapsedMs = gameState.elapsedMs;
    delta.playerDeaths = gameState.playerDeaths;
    delta.wordsTyped = gameState.wordsTyped;
    delta.eventCounts = gameState.eventCounts;
    return delta;
  }

  if (data.type === 'move') {
    const direction = data.direction as Direction;
    const previous = gameState.players[playerId];

    if (!previous.alive) {
      delta.type = 'move-ignored';
      delta.reason = 'player-dead';
      return delta;
    }

    const next = moveWithWrap({ x: previous.x, y: previous.y }, direction);
    gameState.players[playerId] = {
      ...previous,
      x: next.x,
      y: next.y
    };
    gameState.wordsTyped[playerId] = (gameState.wordsTyped[playerId] || 0) + 1;

    delta.type = 'player-moved';
    delta.player = gameState.players[playerId];
    delta.wordsTyped = gameState.wordsTyped;
  } else if (data.type === 'player-state') {
    const incoming = normalizePosition(data.player || {});
    const alive = Boolean(data.player?.alive);
    gameState.players[playerId] = {
      x: incoming.x,
      y: incoming.y,
      alive
    };

    delta.type = 'player-state';
    delta.player = gameState.players[playerId];
  } else if (data.type === 'player-killed') {
    const current = gameState.players[playerId];
    const pos = data.position ? normalizePosition(data.position) : { x: current.x, y: current.y };
    const wasAlive = current.alive;

    gameState.players[playerId] = {
      x: pos.x,
      y: pos.y,
      alive: false
    };

    if (wasAlive) {
      gameState.playerDeaths[playerId] = (gameState.playerDeaths[playerId] || 0) + 1;
    }

    const ended = checkAndHandleGameOver(session);

    delta.type = 'player-killed';
    delta.player = gameState.players[playerId];
    delta.playerDeaths = gameState.playerDeaths;
    delta.gameOver = ended || gameState.gameOver;

    if (delta.gameOver) {
      delta.elapsedMs = gameState.elapsedMs;
      delta.eventCounts = gameState.eventCounts;
      delta.wordsTyped = gameState.wordsTyped;
    }
  } else if (data.type === 'player-revived') {
    const current = gameState.players[playerId];
    const pos = data.position ? normalizePosition(data.position) : { x: current.x, y: current.y };

    gameState.players[playerId] = {
      x: pos.x,
      y: pos.y,
      alive: true
    };

    delta.type = 'player-revived';
    delta.player = gameState.players[playerId];
  } else if (data.type === 'position-update') {
    // Backward compatibility with older client payloads.
    const pos = normalizePosition(data.position || {});
    const current = gameState.players[playerId];
    gameState.players[playerId] = {
      ...current,
      x: pos.x,
      y: pos.y
    };

    delta.type = 'player-moved';
    delta.player = gameState.players[playerId];
  } else {
    delta.type = 'noop';
  }

  delta.elapsedMs = gameState.elapsedMs;

  return delta;
}
