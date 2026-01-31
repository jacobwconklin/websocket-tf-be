class Player {
  constructor(id, alias, color, font, icon) {
    this.id = id;
    this.alias = alias;
    this.color = color;
    this.font = font;
    this.icon = icon;
  }

  toJSON() {
    return {
      id: this.id,
      alias: this.alias,
      color: this.color,
      font: this.font,
      icon: this.icon
    };
  }
}

module.exports = Player;
