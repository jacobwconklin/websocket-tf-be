export type PlayerConnectionState = 'connected' | 'disconnected' | 'kicked';

export default class Player {
  id: string;
  alias?: string | null;
  color?: string | null;
  font?: string | null;
  icon?: string | null;
  connectionState: PlayerConnectionState;
  lastSeenAt: number;
  currentSocketId: string | null;

  constructor(
    id: string,
    alias?: string | null,
    color?: string | null,
    font?: string | null,
    icon?: string | null,
    connectionState: PlayerConnectionState = 'connected',
    lastSeenAt: number = Date.now(),
    currentSocketId: string | null = null
  ) {
    this.id = id;
    this.alias = alias ?? null;
    this.color = color ?? null;
    this.font = font ?? null;
    this.icon = icon ?? null;
    this.connectionState = connectionState;
    this.lastSeenAt = lastSeenAt;
    this.currentSocketId = currentSocketId;
  }

  markConnected(socketId: string) {
    this.connectionState = 'connected';
    this.currentSocketId = socketId;
    this.lastSeenAt = Date.now();
  }

  markDisconnected() {
    this.connectionState = 'disconnected';
    this.currentSocketId = null;
    this.lastSeenAt = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      alias: this.alias,
      color: this.color,
      font: this.font,
      icon: this.icon,
      connectionState: this.connectionState,
      lastSeenAt: this.lastSeenAt,
      currentSocketId: this.currentSocketId
    };
  }
}
