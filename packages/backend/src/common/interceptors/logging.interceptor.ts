import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * LoggingInterceptor - Interceptor untuk HTTP request/response logging
 * 
 * Interceptor ini menangkap semua request HTTP yang masuk dan response yang keluar,
 * kemudian mencatat method, URL, status code, dan response time (ms).
 * 
 * Format: [timestamp] [INFO] [LoggingInterceptor] method URL [status] responseTime ms
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LoggingInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();
    
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        const delay = Date.now() - now;
        
        this.logger.log(`${method} ${url} [${statusCode}] ${delay}ms`);
      }),
    );
  }
}
