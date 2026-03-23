import { Injectable, Logger } from '@nestjs/common';

export interface PlayerState {
  id: string;
  username: string;
  color: string;
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  floor: number;
  isMoving: boolean;
}

@Injectable()
export class OfficeStateService {
  private readonly logger = new Logger(OfficeStateService.name);
  private players = new Map<string, PlayerState>();

  private readonly AVATAR_COLORS = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#a855f7',
    '#e11d48',
  ];

  addPlayer(socketId: string, username: string): PlayerState {
    const color =
      this.AVATAR_COLORS[Math.floor(Math.random() * this.AVATAR_COLORS.length)];

    const player: PlayerState = {
      id: socketId,
      username,
      color,
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 },
      floor: 1,
      isMoving: false,
    };

    this.players.set(socketId, player);
    this.logger.log(
      `Player added: ${username} (${socketId}) — total: ${this.players.size}`,
    );
    return player;
  }

  removePlayer(socketId: string): PlayerState | undefined {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      this.logger.log(
        `Player removed: ${player.username} (${socketId}) — total: ${this.players.size}`,
      );
    }
    return player;
  }

  updatePosition(
    socketId: string,
    position: { x: number; y: number; z: number },
    rotation: { y: number },
    floor: number,
    isMoving: boolean,
  ): void {
    const player = this.players.get(socketId);
    if (player) {
      player.position = position;
      player.rotation = rotation;
      player.floor = floor;
      player.isMoving = isMoving;
    }
  }

  getPlayer(socketId: string): PlayerState | undefined {
    return this.players.get(socketId);
  }

  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  getPlayersByFloor(floor: number): PlayerState[] {
    return this.getAllPlayers().filter((p) => p.floor === floor);
  }

  getPlayerCount(): number {
    return this.players.size;
  }
}
