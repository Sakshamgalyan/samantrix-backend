import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  private requestCounter = 0;

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = [
      'password',
      'newPassword',
      'currentPassword',
      'token',
      'refresh_token',
      'access_token',
      'otp',
      'refreshToken',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    }

    return sanitized;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;
    const now = Date.now();
    const requestId = ++this.requestCounter;

    const handlerName = context.getHandler().name;
    const className = context.getClass().name;

    // Build user context for logging
    const userContext = user
      ? `User: ${user.email || user.employeeId || user.sub}`
      : 'Anonymous';

    this.logger.log(
      `[${requestId}] Incoming Request: [${method}] ${url} - Handler: ${className}.${handlerName} - ${userContext}`,
    );

    // Log body for non-GET requests (with sensitive data sanitization)
    if (method !== 'GET' && body && Object.keys(body).length > 0) {
      const sanitizedBody = this.sanitizeData(body);
      this.logger.debug(
        `[${requestId}] Request Body: ${JSON.stringify(sanitizedBody)}`,
      );
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const delay = Date.now() - now;
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;

          // Log response size if data is available
          const dataSize = data ? JSON.stringify(data).length : 0;

          this.logger.log(
            `[${requestId}] Outgoing Response: [${method}] ${url} - Status: ${statusCode} - ${delay}ms - Size: ${dataSize} bytes`,
          );
        },
        error: (error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `[${requestId}] Request Failed: [${method}] ${url} - ${delay}ms - Error: ${error.message}`,
            error.stack,
          );
        },
      }),
    );
  }
}
