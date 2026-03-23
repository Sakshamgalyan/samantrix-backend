import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { UserService } from 'src/user/user.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromCookie(request);

    if (!token) {
      this.logger.warn(`No token found in request to ${request.url}`);
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRETKEY'),
      });

      const user = await this.userService.findById(payload.sub);
      if (!user) {
        this.logger.warn(`User not found for sub: ${payload.sub}`);
        throw new UnauthorizedException('User no longer exists');
      }

      // Temporarily log verification status instead of blocking
      if (!user.isVerified) {
        this.logger.warn(`User ${user.email} is not verified but allowing access to profile for debugging`);
        // throw new UnauthorizedException('Email not verified');
      }

      request['user'] = payload;
    } catch (error) {
      this.logger.error(`Auth failure for ${request.url}: ${error.message}`);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    if (request.cookies?.access_token) {
      return request.cookies.access_token;
    }
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
