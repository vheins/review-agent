import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ApiKeyGuard - Guard for API key authentication
 * 
 * Validates the X-API-Key header against the configured key.
 * 
 * Requirements: 3.5, 18.4
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    
    const configuredKey = this.configService.get<string>('API_KEY') || 'dev-key';

    if (!apiKey || apiKey !== configuredKey) {
      throw new UnauthorizedException('Invalid or missing API Key');
    }

    return true;
  }
}
