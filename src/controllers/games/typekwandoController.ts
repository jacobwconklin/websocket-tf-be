import Session from '../../models/Session';
import type { Server } from 'socket.io';

const GRID_SIZE = 10;
const TYPING_PHASE_MS = 35_000;
const TYPING_COUNTDOWN_MS = 4_000;
const WATCH_TICK_MS = 1_000;
const MAX_RING_DEPTH = Math.floor((GRID_SIZE - 3) / 2);

type MoveDirection = 'up' | 'left' | 'right' | 'down' | 'wait';
type AttackDirection = 'up' | 'left' | 'right' | 'down';
type ActionType = 'punch' | 'kick' | 'block';
type Phase = 'typing' | 'watching' | 'finished';

type ParsedCommand =
  | { kind: 'move'; direction: MoveDirection; source: string }
  | { kind: 'action'; action: ActionType; direction: AttackDirection; source: string };

interface GridPosition {
  x: number;
  y: number;
}

interface TypekwandoPlayerState {
  x: number;
  y: number;
  alive: boolean;
}

interface TypekwandoState {
  gameType: 'typekwando';
  gridSize: number;
  phase: Phase;
  turnNumber: number;
  phaseEndsAt: number | null;
  typingStartsAt: number | null;
  typingDurationMs: number;
  typingCountdownMs: number;
  watchTickMs: number;
  ringDepth: number;
  players: Record<string, TypekwandoPlayerState>;
  turnStartPlayers: Record<string, TypekwandoPlayerState>;
  commandQueues: Record<string, ParsedCommand[]>;
  wordsTyped: Record<string, number>;
  turnSubmittedWordCounts: Record<string, number>;
  eliminationOrder: string[];
  submittedPlayerIds: string[];
  watchIndex: number;
  watchLength: number;
  winnerId: string | null;
  draw: boolean;
  finishedAt: number | null;
}

interface TypekwandoLoop {
  io: Server;
  timer: NodeJS.Timeout;
}

const loops: Map<string, TypekwandoLoop> = new Map();

function buildOuterRingCells(size: number): GridPosition[] {
  const cells: GridPosition[] = [];

  for (let x = 0; x < size; x += 1) cells.push({ x, y: 0 });
  for (let y = 1; y < size; y += 1) cells.push({ x: size - 1, y });
  for (let x = size - 2; x >= 0; x -= 1) cells.push({ x, y: size - 1 });
  for (let y = size - 2; y >= 1; y -= 1) cells.push({ x: 0, y });

  return cells;
}

function createInitialPlayers(session: Session): Record<string, TypekwandoPlayerState> {
  const outerRingCells = buildOuterRingCells(GRID_SIZE);
  const players: Record<string, TypekwandoPlayerState> = {};

  session.players.forEach((player, index) => {
    const spawn = outerRingCells[index % outerRingCells.length];
    players[player.id] = {
      x: spawn.x,
      y: spawn.y,
      alive: true
    };
  });

  return players;
}

function getState(session: Session): TypekwandoState {
  return session.gameState as TypekwandoState;
}

function clonePlayers(players: Record<string, TypekwandoPlayerState>): Record<string, TypekwandoPlayerState> {
  const copy: Record<string, TypekwandoPlayerState> = {};
  Object.entries(players).forEach(([playerId, player]) => {
    copy[playerId] = {
      x: player.x,
      y: player.y,
      alive: player.alive
    };
  });
  return copy;
}

function getBounds(state: TypekwandoState) {
  const min = state.ringDepth;
  const max = state.gridSize - 1 - state.ringDepth;
  return { min, max };
}

function clampToBounds(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isWithinBounds(x: number, y: number, bounds: { min: number; max: number }): boolean {
  return x >= bounds.min && x <= bounds.max && y >= bounds.min && y <= bounds.max;
}

function getAlivePlayerIds(state: TypekwandoState): string[] {
  return Object.entries(state.players)
    .filter(([, player]) => player.alive)
    .map(([playerId]) => playerId);
}

function normalizeToken(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function parseCommandQueue(rawCommands: string[]): ParsedCommand[] {
  const parsed: ParsedCommand[] = [];
  let requiresMoveBeforeNextAction = true;
  let lastMovedDirection: AttackDirection | null = null;

  for (let index = 0; index < rawCommands.length; index += 1) {
    const token = normalizeToken(rawCommands[index]);

    if (token === 'up' || token === 'left' || token === 'right' || token === 'down' || token === 'wait') {
      parsed.push({ kind: 'move', direction: token, source: token });
      if (token === 'up' || token === 'left' || token === 'right' || token === 'down') {
        lastMovedDirection = token;
      }
      requiresMoveBeforeNextAction = false;
      continue;
    }

    if (token === 'punch' || token === 'kick' || token === 'block') {
      if (requiresMoveBeforeNextAction || !lastMovedDirection) {
        continue;
      }

      parsed.push({
        kind: 'action',
        action: token,
        direction: lastMovedDirection,
        source: `${token}:${lastMovedDirection}`
      });

      requiresMoveBeforeNextAction = true;
    }
  }

  return parsed;
}

function moveInDirection(position: GridPosition, direction: MoveDirection, bounds: { min: number; max: number }): GridPosition {
  if (direction === 'wait') {
    return { x: position.x, y: position.y };
  }

  const next = { x: position.x, y: position.y };
  if (direction === 'up') next.y -= 1;
  if (direction === 'down') next.y += 1;
  if (direction === 'left') next.x -= 1;
  if (direction === 'right') next.x += 1;

  return {
    x: clampToBounds(next.x, bounds.min, bounds.max),
    y: clampToBounds(next.y, bounds.min, bounds.max)
  };
}

function offsetForDirection(direction: AttackDirection): GridPosition {
  if (direction === 'up') return { x: 0, y: -1 };
  if (direction === 'down') return { x: 0, y: 1 };
  if (direction === 'left') return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

function perpendicularOffsets(direction: AttackDirection): [GridPosition, GridPosition] {
  if (direction === 'up' || direction === 'down') {
    return [{ x: -1, y: 0 }, { x: 1, y: 0 }];
  }

  return [{ x: 0, y: -1 }, { x: 0, y: 1 }];
}

function checkForMatchEnd(state: TypekwandoState, io: Server, joinCode: string): boolean {
  const aliveIds = getAlivePlayerIds(state);

  if (aliveIds.length > 1) {
    return false;
  }

  state.phase = 'finished';
  state.phaseEndsAt = null;
  state.finishedAt = Date.now();
  state.winnerId = aliveIds.length === 1 ? aliveIds[0] : null;
  state.draw = aliveIds.length === 0;

  io.to(joinCode).emit('game-update', {
    gameType: 'typekwando',
    type: 'typekwando-game-over',
    phase: state.phase,
    winnerId: state.winnerId,
    draw: state.draw,
    players: state.players,
    wordsTyped: state.wordsTyped,
    eliminationOrder: state.eliminationOrder
  });

  stopTypekwandoLoop(joinCode);
  return true;
}

function schedule(joinCode: string, fn: () => void, delayMs: number) {
  const loop = loops.get(joinCode);
  if (!loop) return;
  clearTimeout(loop.timer);
  loop.timer = setTimeout(fn, delayMs);
}

function applyRingEncroachment(state: TypekwandoState) {
  if (state.ringDepth >= MAX_RING_DEPTH) {
    return;
  }

  state.ringDepth += 1;
  const bounds = getBounds(state);

  Object.values(state.players).forEach((player) => {
    if (!player.alive) return;
    player.x = clampToBounds(player.x, bounds.min, bounds.max);
    player.y = clampToBounds(player.y, bounds.min, bounds.max);
  });
}

function startTypingPhase(session: Session, io: Server, joinCode: string) {
  const state = getState(session);
  if (state.phase === 'finished') return;

  const now = Date.now();

  state.phase = 'typing';
  state.phaseEndsAt = now + state.typingDurationMs;
  state.typingStartsAt = now + state.typingCountdownMs;
  state.submittedPlayerIds = [];
  state.watchIndex = 0;
  state.watchLength = 0;
  state.turnSubmittedWordCounts = {};
  state.turnStartPlayers = clonePlayers(state.players);

  getAlivePlayerIds(state).forEach((playerId) => {
    state.commandQueues[playerId] = [];
  });

  io.to(joinCode).emit('game-update', {
    gameType: 'typekwando',
    type: 'typekwando-phase-changed',
    phase: state.phase,
    turnNumber: state.turnNumber,
    phaseEndsAt: state.phaseEndsAt,
    typingStartsAt: state.typingStartsAt,
    ringDepth: state.ringDepth,
    players: state.players,
    submittedPlayerIds: state.submittedPlayerIds
  });

  schedule(joinCode, () => startWatchingPhase(session, io, joinCode), state.typingDurationMs);
}

function executeWatchTick(session: Session, io: Server, joinCode: string) {
  const state = getState(session);
  if (state.phase !== 'watching') return;

  const bounds = getBounds(state);
  const aliveIds = getAlivePlayerIds(state);
  const playerColorById = new Map(session.players.map((player) => [player.id, player.color]));
  const movementTargets: Record<string, GridPosition> = {};
  const blockingPlayers = new Set<string>();
  const attacks: Array<{ attackerId: string; x: number; y: number; action: ActionType }> = [];
  const actionHighlights: Array<{ playerId: string; x: number; y: number; action: ActionType; color: string }> = [];
  const commandsAtTick: Record<string, string> = {};

  aliveIds.forEach((playerId) => {
    const playerState = state.players[playerId];
    const command = state.commandQueues[playerId]?.[state.watchIndex];

    if (!command) {
      commandsAtTick[playerId] = 'none';
      return;
    }

    commandsAtTick[playerId] = command.source;

    if (command.kind === 'move') {
      movementTargets[playerId] = moveInDirection(playerState, command.direction, bounds);
      return;
    }

    if (command.action === 'block') {
      blockingPlayers.add(playerId);
      actionHighlights.push({
        playerId,
        x: playerState.x,
        y: playerState.y,
        action: 'block',
        color: '#ffffff'
      });
      return;
    }

    const actionColor = playerColorById.get(playerId) || '#67e8f9';

    if (command.action === 'punch') {
      const directionOffset = offsetForDirection(command.direction);

      const punchTargets: GridPosition[] = [
        { x: playerState.x, y: playerState.y },
        { x: playerState.x + directionOffset.x, y: playerState.y + directionOffset.y },
        { x: playerState.x + directionOffset.x * 2, y: playerState.y + directionOffset.y * 2 }
      ];

      punchTargets.forEach((target) => {
        if (!isWithinBounds(target.x, target.y, bounds)) return;
        attacks.push({ attackerId: playerId, x: target.x, y: target.y, action: 'punch' });
        actionHighlights.push({
          playerId,
          x: target.x,
          y: target.y,
          action: 'punch',
          color: actionColor
        });
      });
      return;
    }

    const directionOffset = offsetForDirection(command.direction);

    const centerTarget = {
      x: playerState.x + directionOffset.x,
      y: playerState.y + directionOffset.y
    };
    const [perpendicularA, perpendicularB] = perpendicularOffsets(command.direction);
    const kickTargets: GridPosition[] = [
      centerTarget,
      { x: centerTarget.x + perpendicularA.x, y: centerTarget.y + perpendicularA.y },
      { x: centerTarget.x + perpendicularB.x, y: centerTarget.y + perpendicularB.y }
    ];

    kickTargets.forEach((target) => {
      if (!isWithinBounds(target.x, target.y, bounds)) return;
      attacks.push({
        attackerId: playerId,
        x: target.x,
        y: target.y,
        action: 'kick'
      });
      actionHighlights.push({
        playerId,
        x: target.x,
        y: target.y,
        action: 'kick',
        color: actionColor
      });
    });
  });

  Object.entries(movementTargets).forEach(([playerId, target]) => {
    const player = state.players[playerId];
    if (!player?.alive) return;
    player.x = target.x;
    player.y = target.y;
  });

  const eliminated = new Set<string>();

  Object.entries(state.players).forEach(([targetId, targetState]) => {
    if (!targetState.alive) return;

    const attacked = attacks.some((attack) =>
      attack.attackerId !== targetId && attack.x === targetState.x && attack.y === targetState.y
    );

    if (!attacked) return;
    if (blockingPlayers.has(targetId)) return;

    eliminated.add(targetId);
  });

  eliminated.forEach((playerId) => {
    state.players[playerId].alive = false;
    if (!state.eliminationOrder.includes(playerId)) {
      state.eliminationOrder.push(playerId);
    }
  });

  io.to(joinCode).emit('game-update', {
    gameType: 'typekwando',
    type: 'typekwando-watch-tick',
    turnNumber: state.turnNumber,
    tick: state.watchIndex + 1,
    watchLength: state.watchLength,
    commandsAtTick,
    actionHighlights,
    eliminatedPlayerIds: Array.from(eliminated),
    players: state.players
  });

  state.watchIndex += 1;

  if (checkForMatchEnd(state, io, joinCode)) {
    return;
  }

  if (state.watchIndex >= state.watchLength) {
    applyRingEncroachment(state);

    io.to(joinCode).emit('game-update', {
      gameType: 'typekwando',
      type: 'typekwando-ring-updated',
      ringDepth: state.ringDepth,
      players: state.players
    });

    if (checkForMatchEnd(state, io, joinCode)) {
      return;
    }

    state.turnNumber += 1;
    startTypingPhase(session, io, joinCode);
    return;
  }

  schedule(joinCode, () => executeWatchTick(session, io, joinCode), state.watchTickMs);
}

function startWatchingPhase(session: Session, io: Server, joinCode: string) {
  const state = getState(session);
  if (state.phase === 'finished') return;

  const aliveIds = getAlivePlayerIds(state);

  aliveIds.forEach((playerId) => {
    const currentTurnCount = state.turnSubmittedWordCounts[playerId] ?? 0;
    state.wordsTyped[playerId] = (state.wordsTyped[playerId] ?? 0) + currentTurnCount;
  });

  state.submittedPlayerIds = [...aliveIds];
  state.players = clonePlayers(state.turnStartPlayers);
  state.phase = 'watching';
  state.phaseEndsAt = null;
  state.typingStartsAt = null;
  state.watchIndex = 0;

  state.watchLength = aliveIds.reduce((longest, playerId) => {
    const queueLength = state.commandQueues[playerId]?.length ?? 0;
    return Math.max(longest, queueLength);
  }, 0);

  io.to(joinCode).emit('game-update', {
    gameType: 'typekwando',
    type: 'typekwando-phase-changed',
    phase: state.phase,
    turnNumber: state.turnNumber,
    watchLength: state.watchLength,
    typingStartsAt: state.typingStartsAt,
    ringDepth: state.ringDepth,
    players: state.players
  });

  if (state.watchLength === 0) {
    applyRingEncroachment(state);

    io.to(joinCode).emit('game-update', {
      gameType: 'typekwando',
      type: 'typekwando-ring-updated',
      ringDepth: state.ringDepth,
      players: state.players
    });

    if (checkForMatchEnd(state, io, joinCode)) {
      return;
    }

    state.turnNumber += 1;
    startTypingPhase(session, io, joinCode);
    return;
  }

  schedule(joinCode, () => executeWatchTick(session, io, joinCode), state.watchTickMs);
}

export function initializeTypekwando(session: Session): TypekwandoState {
  const players = createInitialPlayers(session);
  const commandQueues: Record<string, ParsedCommand[]> = {};
  const wordsTyped: Record<string, number> = {};

  Object.keys(players).forEach((playerId) => {
    commandQueues[playerId] = [];
    wordsTyped[playerId] = 0;
  });

  return {
    gameType: 'typekwando',
    gridSize: GRID_SIZE,
    phase: 'typing',
    turnNumber: 1,
    phaseEndsAt: null,
    typingStartsAt: null,
    typingDurationMs: TYPING_PHASE_MS,
    typingCountdownMs: TYPING_COUNTDOWN_MS,
    watchTickMs: WATCH_TICK_MS,
    ringDepth: 0,
    players,
    turnStartPlayers: clonePlayers(players),
    commandQueues,
    wordsTyped,
    turnSubmittedWordCounts: {},
    eliminationOrder: [],
    submittedPlayerIds: [],
    watchIndex: 0,
    watchLength: 0,
    winnerId: null,
    draw: false,
    finishedAt: null
  };
}

export function startTypekwandoLoop(session: Session, io: Server) {
  if (session.gameName !== 'typekwando') return;

  stopTypekwandoLoop(session.joinCode);
  loops.set(session.joinCode, {
    io,
    timer: setTimeout(() => undefined, 0)
  });

  if (!session.gameState || session.gameState.gameType !== 'typekwando') {
    session.gameState = initializeTypekwando(session);
  }

  startTypingPhase(session, io, session.joinCode);
}

export function stopTypekwandoLoop(joinCode: string) {
  const loop = loops.get(joinCode);
  if (!loop) return;

  clearTimeout(loop.timer);
  loops.delete(joinCode);
}

export function updateTypekwando(session: Session, playerId: string, data: any): any {
  if (!session.gameState || session.gameState.gameType !== 'typekwando') {
    session.gameState = initializeTypekwando(session);
  }

  const state = getState(session);

  if (state.phase === 'finished') {
    return {
      gameType: 'typekwando',
      type: 'typekwando-game-over',
      phase: state.phase,
      winnerId: state.winnerId,
      draw: state.draw,
      players: state.players,
      wordsTyped: state.wordsTyped,
      eliminationOrder: state.eliminationOrder
    };
  }

  if (data.type !== 'typekwando-submit-turn' && data.type !== 'typekwando-sync-turn') {
    return {
      gameType: 'typekwando',
      type: 'typekwando-ignored-update',
      phase: state.phase
    };
  }

  const playerState = state.players[playerId];
  if (!playerState || !playerState.alive) {
    return {
      gameType: 'typekwando',
      type: 'typekwando-submit-rejected',
      reason: 'player-eliminated',
      playerId
    };
  }

  if (state.phase !== 'typing') {
    return {
      gameType: 'typekwando',
      type: 'typekwando-submit-rejected',
      reason: 'not-typing-phase',
      playerId,
      phase: state.phase
    };
  }

  if (state.typingStartsAt && Date.now() < state.typingStartsAt) {
    return {
      gameType: 'typekwando',
      type: 'typekwando-submit-rejected',
      reason: 'typing-countdown-active',
      playerId,
      typingStartsAt: state.typingStartsAt,
      phaseEndsAt: state.phaseEndsAt
    };
  }

  const rawCommands = Array.isArray(data.commands)
    ? data.commands.map((value: unknown) => String(value))
    : [];
  const parsed = parseCommandQueue(rawCommands);
  state.commandQueues[playerId] = parsed;

  const currentSubmittedCount = rawCommands.length;
  state.turnSubmittedWordCounts[playerId] = currentSubmittedCount;

  return {
    gameType: 'typekwando',
    type: data.type === 'typekwando-sync-turn' ? 'typekwando-turn-synced' : 'typekwando-turn-submitted',
    playerId,
    parsedCommandCount: parsed.length,
    rawCommandCount: rawCommands.length,
    wordsTypedTotal: state.wordsTyped[playerId] ?? 0,
    submittedPlayerIds: state.submittedPlayerIds,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    typingStartsAt: state.typingStartsAt
  };
}
