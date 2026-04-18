import Player from './Player';

export type SessionPhase = 'lobby' | 'in_game' | 'game_select' | 'ended';

export default class Session {
  joinCode: string;
  gameName: string | null;
  players: Player[];
  gameState: Record<string, any>;
  started: boolean;
  createdAt: Date;
  phase: SessionPhase;
  lobbyOpen: boolean;
  hostPlayerId: string | null;
  version: number;

  constructor(joinCode: string, gameName: string | null = null) {
    this.joinCode = joinCode;
    this.gameName = gameName;
    this.players = [];
    this.gameState = {};
    this.started = false;
    this.createdAt = new Date();
    this.phase = 'lobby';
    this.lobbyOpen = true;
    this.hostPlayerId = null;
    this.version = 1;
  }

  private bumpVersion() {
    this.version += 1;
  }

  addPlayer(player: Player): Player {
    const existing = this.getPlayer(player.id);
    if (existing) {
      Object.assign(existing, player);
      this.bumpVersion();
      return existing;
    }
    this.players.push(player);
    this.bumpVersion();
    return player;
  }

  removePlayer(playerId: string) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.bumpVersion();
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.find(p => p.id === playerId);
  }

  markPlayerConnected(playerId: string, socketId: string): Player | undefined {
    const player = this.getPlayer(playerId);
    if (!player) return undefined;
    player.markConnected(socketId);
    this.bumpVersion();
    return player;
  }

  markPlayerDisconnected(playerId: string): Player | undefined {
    const player = this.getPlayer(playerId);
    if (!player) return undefined;
    player.markDisconnected();
    this.bumpVersion();
    return player;
  }

  setPhase(phase: SessionPhase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.bumpVersion();
  }

  setLobbyOpen(lobbyOpen: boolean) {
    if (this.lobbyOpen === lobbyOpen) return;
    this.lobbyOpen = lobbyOpen;
    this.bumpVersion();
  }

  setHostPlayerId(playerId: string | null) {
    if (this.hostPlayerId === playerId) return;
    this.hostPlayerId = playerId;
    this.bumpVersion();
  }

  resetToLobby() {
    this.gameName = null;
    this.gameState = {};
    this.started = false;
    this.setPhase('lobby');
    this.setLobbyOpen(true);
    this.bumpVersion();
  }

  toSnapshot() {
    return {
      joinCode: this.joinCode,
      gameName: this.gameName,
      players: this.players.map(p => p.toJSON()),
      gameState: this.gameState,
      started: this.started,
      createdAt: this.createdAt,
      phase: this.phase,
      lobbyOpen: this.lobbyOpen,
      hostPlayerId: this.hostPlayerId,
      version: this.version
    };
  }

  toJSON() {
    return this.toSnapshot();
  }
}
