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
      try {
        this.logger.debug(
          `[${requestId}] Request Body: ${JSON.stringify(sanitizedBody)}`,
        );
      } catch (e) {
        this.logger.debug(
          `[${requestId}] Request Body: [Circular or unstringifiable]`,
        );
      }
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const delay = Date.now() - now;
          const response = context.switchToHttp().getResponse();
          const statusCode = response?.statusCode || 200;

          // Log response size if data is available (with safety check)
          let dataSize = 0;
          if (data) {
            // Check if data is an Express/Nest Response object (often returned by @Res())
            // Response objects have circles and shouldn't be stringified.
            const isResponseObject = data && typeof data.status === 'function' && typeof data.send === 'function';
            
            if (isResponseObject) {
              dataSize = -1; // Indicate it's a response object
            } else {
              try {
                dataSize = JSON.stringify(data).length;
              } catch (e) {
                dataSize = -2; // Circular
              }
            }
          }

          const sizeLabel = dataSize === -1 ? 'Response object' : dataSize === -2 ? 'Circular' : `${dataSize} bytes`;

          this.logger.log(
            `[${requestId}] Outgoing Response: [${method}] ${url} - Status: ${statusCode} - ${delay}ms - Size: ${sizeLabel}`,
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
