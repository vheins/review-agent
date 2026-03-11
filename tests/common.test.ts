import { ApiKeyGuard } from '../src/common/guards/api-key.guard.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';

describe('Common Guards and Filters', () => {
  describe('ApiKeyGuard', () => {
    let guard: ApiKeyGuard;
    let configService: any;
    let auditLogger: any;

    beforeEach(() => {
      configService = {
        get: vi.fn().mockReturnValue('test-key'),
      };
      auditLogger = {
        logAction: vi.fn().mockResolvedValue(true),
      };
      guard = new ApiKeyGuard(configService, auditLogger);
    });

    it('should allow request with valid API key', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-api-key': 'test-key' },
            method: 'GET',
            url: '/test',
          }),
        }),
      } as any;

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw UnauthorizedException with invalid key', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-api-key': 'wrong-key' },
            method: 'GET',
            url: '/test',
          }),
        }),
      } as any;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(auditLogger.logAction).toHaveBeenCalled();
    });
  });

  describe('GlobalExceptionFilter', () => {
    let filter: GlobalExceptionFilter;
    let response: any;
    let host: any;

    beforeEach(() => {
      filter = new GlobalExceptionFilter();
      response = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      host = {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => ({ url: '/test', method: 'GET' }),
        }),
      } as any;
    });

    it('should catch HttpException and return structured response', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        path: '/test',
      }));
    });

    it('should catch unknown errors and return 500', () => {
      const error = new Error('Unknown');
      filter.catch(error, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
