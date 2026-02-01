import Player from './Player';

export default class Session {
  joinCode: string;
  gameName: string | null;
  players: Player[];
  gameState: Record<string, any>;
  started: boolean;
  createdAt: Date;

  constructor(joinCode: string, gameName: string | null = null) {
    this.joinCode = joinCode;
    this.gameName = gameName;
    this.players = [];
    this.gameState = {};
    this.started = false;
    this.createdAt = new Date();
  }

  addPlayer(player: Player): Player {
    const existing = this.getPlayer(player.id);
    if (existing) {
      Object.assign(existing, player);
      return existing;
    }
    this.players.push(player);
    return player;
  }

  removePlayer(playerId: string) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.find(p => p.id === playerId);
  }

  toJSON() {
    return {
      joinCode: this.joinCode,
      gameName: this.gameName,
      players: this.players.map(p => p.toJSON()),
      gameState: this.gameState,
      started: this.started,
      createdAt: this.createdAt
    };
  }
}
