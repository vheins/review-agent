import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLoggerService } from '../audit/audit-logger.service.js';

/**
 * ApiKeyGuard - Guard for API key authentication
 * 
 * Validates the X-API-Key header against the configured key.
 * 
 * Requirements: 3.5, 18.4
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private auditLogger: AuditLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    
    const configuredKey = this.configService.get<string>('API_KEY') || 'dev-key';

    if (!apiKey || apiKey !== configuredKey) {
      this.auditLogger.logAction(
        'auth_failed',
        'anonymous',
        'api',
        request.url,
        { ip, reason: apiKey ? 'invalid_key' : 'missing_key' },
        { actorType: 'external', ipAddress: ip }
      );
      throw new UnauthorizedException('Invalid or missing API Key');
    }

    // Optional: log successful auth for critical actions
    if (request.method !== 'GET') {
      this.auditLogger.logAction(
        'auth_success',
        'api-client',
        'api',
        request.url,
        { ip, method: request.method },
        { actorType: 'external', ipAddress: ip }
      );
    }

    return true;
  }
}
