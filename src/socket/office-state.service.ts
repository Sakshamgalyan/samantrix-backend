import { Injectable, Logger } from '@nestjs/common';

export interface PlayerState {
  id: string; // The user ID from DB
  socketId: string;
  username: string;
  color: string;
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  floor: number;
  isMoving: boolean;
  lastMoveTime: number;
  customization?: {
    hairStyle: string;
    accessory: string;
  };
}

@Injectable()
export class OfficeStateService {
  private readonly logger = new Logger(OfficeStateService.name);
  private players = new Map<string, PlayerState>();

  addPlayer(
    userId: string,
    socketId: string,
    username: string,
    customization?: { color: string; hairStyle: string; accessory: string },
  ): PlayerState {
    // Prevent duplicate sessions for same user
    this.removePlayerByUserId(userId);

    const player: PlayerState = {
      id: userId,
      socketId,
      username,
      color: customization?.color || '#6366f1',
      position: { x: 0, y: 0.1, z: 5 }, // Default spawn pos
      rotation: { y: 0 },
      floor: 1,
      isMoving: false,
      lastMoveTime: Date.now(),
      customization: {
        hairStyle: customization?.hairStyle || 'none',
        accessory: customization?.accessory || 'none',
      },
    };

    this.players.set(socketId, player);
    this.logger.log(
      `Player added: ${username} (User: ${userId}, Socket: ${socketId}) — total: ${this.players.size}`,
    );
    return player;
  }

  removePlayerBySocketId(socketId: string): PlayerState | undefined {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      this.logger.log(
        `Player removed: ${player.username} (Socket: ${socketId}) — total: ${this.players.size}`,
      );
    }
    return player;
  }

  removePlayerByUserId(userId: string): void {
    const player = this.getPlayerByUserId(userId);
    if (player) {
      this.players.delete(player.socketId);
      this.logger.log(
        `Duplicate session removed for user: ${player.username} (User: ${userId}) — total: ${this.players.size}`,
      );
    }
  }

  updatePosition(
    socketId: string,
    position: { x: number; y: number; z: number },
    rotation: { y: number },
    floor: number,
    isMoving: boolean,
  ): boolean {
    const player = this.players.get(socketId);
    if (!player) return false;

    // Delta check to avoid broadcasting stationary updates
    const dx = player.position.x - position.x;
    const dy = player.position.y - position.y;
    const dz = player.position.z - position.z;
    const dRot = Math.abs(player.rotation.y - rotation.y);
    
    // Meaningful change thresholds
    const positionChanged = (dx * dx + dy * dy + dz * dz) > 0.0001;
    const rotationChanged = dRot > 0.01;
    const stateChanged = player.isMoving !== isMoving || player.floor !== floor;

    if (!positionChanged && !rotationChanged && !stateChanged) {
      return false; // No meaningful change
    }

    player.position = position;
    player.rotation = rotation;
    player.floor = floor;
    player.isMoving = isMoving;
    player.lastMoveTime = Date.now();
    
    return true;
  }

  getPlayerBySocketId(socketId: string): PlayerState | undefined {
    return this.players.get(socketId);
  }

  getPlayerByUserId(userId: string): PlayerState | undefined {
    return Array.from(this.players.values()).find((p) => p.id === userId);
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
