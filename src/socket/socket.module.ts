import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { OfficeStateService } from './office-state.service';

@Module({
  providers: [SocketGateway, OfficeStateService],
  exports: [SocketGateway, OfficeStateService],
})
export class SocketModule {}
