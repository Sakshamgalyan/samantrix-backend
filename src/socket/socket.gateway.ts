import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OfficeStateService, PlayerState } from './office-state.service';

interface JoinPayload {
  username: string;
}

interface MovePayload {
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  floor: number;
  isMoving: boolean;
}

interface ChatPayload {
  message: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('OfficeGateway');

  constructor(private readonly officeState: OfficeStateService) {}

  afterInit() {
    this.logger.log('Office WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const player = this.officeState.removePlayer(client.id);
    if (player) {
      this.server.emit('player:left', { id: client.id });
      this.logger.log(`Player left: ${player.username}`);
    }
  }

  @SubscribeMessage('player:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ) {
    const player = this.officeState.addPlayer(client.id, payload.username);

    // Send the new player their own state + all existing players
    const existingPlayers = this.officeState
      .getAllPlayers()
      .filter((p) => p.id !== client.id);

    client.emit('player:welcome', {
      self: player,
      players: existingPlayers,
    });

    // Broadcast the new player to everyone else
    client.broadcast.emit('player:joined', player);

    return { success: true };
  }

  @SubscribeMessage('player:move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MovePayload,
  ) {
    this.officeState.updatePosition(
      client.id,
      payload.position,
      payload.rotation,
      payload.floor,
      payload.isMoving,
    );

    // Broadcast to everyone except sender
    client.broadcast.emit('player:moved', {
      id: client.id,
      position: payload.position,
      rotation: payload.rotation,
      floor: payload.floor,
      isMoving: payload.isMoving,
    });
  }

  @SubscribeMessage('player:chat')
  handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatPayload,
  ) {
    const player = this.officeState.getPlayer(client.id);
    if (!player) return;

    const chatMessage = {
      id: `${client.id}-${Date.now()}`,
      playerId: client.id,
      username: player.username,
      color: player.color,
      message: payload.message,
      timestamp: Date.now(),
    };

    // Broadcast to everyone including sender
    this.server.emit('player:chat', chatMessage);
  }
}
