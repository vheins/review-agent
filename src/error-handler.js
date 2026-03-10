import { dbManager } from './database.js';
import { logger } from './logger.js';
import { wsManager } from './websocket-server.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', context = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
    this.isOperational = true;
  }
}

export class ErrorLogger {
  constructor(dependencies = {}) {
    this.dbManager = dependencies.dbManager ?? dbManager;
    this.logger = dependencies.logger ?? logger;
    this.wsManager = dependencies.wsManager ?? wsManager;
  }

  log(error, context = {}) {
    const normalized = this.normalize(error, context);

    this.logger.error(`${normalized.code}: ${normalized.message}`, normalized.context);

    if (this.dbManager.isAvailable()) {
      this.dbManager.db.prepare(`
        INSERT INTO error_logs (
          code,
          message,
          stack_trace,
          severity,
          context,
          request_path,
          request_method,
          actor_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        normalized.code,
        normalized.message,
        normalized.stackTrace,
        normalized.severity,
        JSON.stringify(normalized.context),
        normalized.requestPath,
        normalized.requestMethod,
        normalized.actorId
      );
    }

    if (normalized.severity === 'critical') {
      this.wsManager.broadcast('health_alert', {
        code: normalized.code,
        message: normalized.message
      });
    }

    return normalized;
  }

  normalize(error, context = {}) {
    const statusCode = error?.statusCode ?? 500;
    const severity = statusCode >= 500 ? 'critical' : 'error';

    return {
      code: error?.code ?? 'INTERNAL_ERROR',
      message: error?.message ?? 'Unexpected error',
      stackTrace: error?.stack ?? null,
      severity,
      requestPath: context.requestPath ?? null,
      requestMethod: context.requestMethod ?? null,
      actorId: context.actorId ?? null,
      context
    };
  }
}

export const errorLogger = new ErrorLogger();

export function globalErrorHandler(err, req, res, next) {
  const requestId = req.headers['x-request-id'] || `${Date.now()}`;
  const statusCode = err?.statusCode ?? 500;
  const code = err?.code ?? 'INTERNAL_ERROR';

  errorLogger.log(err, {
    requestId,
    requestPath: req.originalUrl,
    requestMethod: req.method,
    actorId: req.headers['x-api-key'] ?? null
  });

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode >= 500 ? 'Internal Server Error' : err.message,
      requestId
    }
  });
}
