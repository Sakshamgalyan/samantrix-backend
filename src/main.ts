import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { AuthGuard } from './auth/guards/auth.guard';
import { UserService } from './user/user.service';

async function samantrix() {
  const logger = new Logger('Samantrix');
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:2000',
      'https://samantrix.galyan.in',
    ],
    credentials: true,
  });
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const userService = app.get(UserService);

  app.useGlobalGuards(
    new AuthGuard(jwtService, configService, reflector, userService),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 6000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
samantrix();
