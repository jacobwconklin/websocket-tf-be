class Session {
  constructor(joinCode, gameName = null) {
    this.joinCode = joinCode;
    this.gameName = gameName;
    this.players = [];
    this.gameState = {};
    this.createdAt = new Date();
  }

  addPlayer(player) {
    const existing = this.getPlayer(player.id);
    if (existing) {
      // update existing player's properties
      Object.assign(existing, player);
      return existing;
    }
    this.players.push(player);
    return player;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  toJSON() {
    return {
      joinCode: this.joinCode,
      gameName: this.gameName,
      players: this.players.map(p => p.toJSON()),
      gameState: this.gameState,
      createdAt: this.createdAt
    };
  }
}

module.exports = Session;
