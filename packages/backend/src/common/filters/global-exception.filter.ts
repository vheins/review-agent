import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorLoggerService } from './error-logger.service.js';

/**
 * GlobalExceptionFilter - Filter for catching all exceptions and returning structured responses
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly errorLogger: ErrorLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'object' ? (message as any).message : message,
      error: typeof message === 'object' ? (message as any).error : 'Internal Server Error',
    };

    // Use ErrorLoggerService for persistent logging
    this.errorLogger.log(exception, {
      requestPath: request.url,
      requestMethod: request.method,
      actorId: request.headers['x-api-key'] || null,
      requestId: request.headers['x-request-id'] || null,
    });

    response.status(status).json(errorResponse);
  }
}
