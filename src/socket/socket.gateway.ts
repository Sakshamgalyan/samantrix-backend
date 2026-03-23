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
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as cookie from 'cookie';
import { UserService } from 'src/user/user.service';

// We no longer blindly trust client username. We get it from token/db.
// But for now, we'll accept it from payload or derive it.
interface JoinPayload {
  username?: string;
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
    origin: [
      'http://localhost:3000',
      'http://localhost:2000',
      'https://samantrix.galyan.in',
    ],
    credentials: true,
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly officeState: OfficeStateService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  afterInit() {
    this.logger.log('Office WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // 1. Try to get token from handshake auth or headers
      let token = client.handshake.auth?.token;
      
      if (!token && client.handshake.headers.cookie) {
        const cookies = cookie.parse(client.handshake.headers.cookie);
        token = cookies.access_token;
      }

      if (!token) {
        this.logger.warn(
          `Connection rejected: No token provided (${client.id})`,
        );
        client.disconnect();
        return;
      }

      // 2. Verify token
      const secret = this.configService.get<string>('JWT_SECRETKEY');
      const payload = await this.jwtService.verifyAsync(token, { secret });
      
      // 3. Attach userId to socket for later use
      client.data.userId = payload.sub;
      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (error) {
      this.logger.warn(
        `Connection rejected: Invalid token (${client.id}) - ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const player = this.officeState.removePlayerBySocketId(client.id);
    if (player) {
      this.server.emit('player:left', { id: player.id });
      this.logger.log(`Player left: ${player.username}`);
    }
  }

  @SubscribeMessage('player:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ) {
    const userId = client.data.userId;
    if (!userId) return { success: false, error: 'Unauthorized' };

    // Fetch user customization from DB
    const user = await this.userService.findById(userId);
    const customization = user?.customization;

    const player = this.officeState.addPlayer(
      userId,
      client.id,
      payload.username || user?.name || 'Anonymous',
      customization,
    );

    // Send the new player their own state + all existing players
    const existingPlayers = this.officeState
      .getAllPlayers()
      .filter((p) => p.socketId !== client.id);

    client.emit('player:welcome', {
      self: player,
      players: existingPlayers,
    });

    // Broadcast the new player to everyone else (including customization)
    client.broadcast.emit('player:joined', player);

    return { success: true, player };
  }

  @SubscribeMessage('player:move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MovePayload,
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const changed = this.officeState.updatePosition(
      client.id,
      payload.position,
      payload.rotation,
      payload.floor,
      payload.isMoving,
    );

    if (!changed) return;

    // Broadcast to everyone except sender
    client.broadcast.emit('player:moved', {
      id: userId,
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
    const userId = client.data.userId;
    if (!userId) return;

    const player = this.officeState.getPlayerBySocketId(client.id);
    if (!player) return;

    const chatMessage = {
      id: `${userId}-${Date.now()}`,
      playerId: userId,
      username: player.username,
      color: player.color,
      message: payload.message,
      timestamp: Date.now(),
    };

    // Broadcast to everyone including sender
    this.server.emit('player:chat', chatMessage);
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { time: Date.now() };
  }
}
