import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { OfficeStateService } from './office-state.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { UserModule } from 'src/user/user.module';

@Module({
  imports: [ConfigModule, JwtModule, UserModule],
  providers: [SocketGateway, OfficeStateService],
  exports: [SocketGateway, OfficeStateService],
})
export class SocketModule {}
