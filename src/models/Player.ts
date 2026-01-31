export default class Player {
  id: string;
  alias?: string | null;
  color?: string | null;
  font?: string | null;
  icon?: string | null;

  constructor(id: string, alias?: string | null, color?: string | null, font?: string | null, icon?: string | null) {
    this.id = id;
    this.alias = alias ?? null;
    this.color = color ?? null;
    this.font = font ?? null;
    this.icon = icon ?? null;
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
