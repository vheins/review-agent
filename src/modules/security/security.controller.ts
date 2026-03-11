import { Controller, Get, Post, Param, ParseIntPipe } from '@nestjs/common';
import { SecurityScannerService } from './security-scanner.service.js';

@Controller('security')
export class SecurityController {
  constructor(private readonly securityScanner: SecurityScannerService) {}

  @Get('findings/:repo/:number')
  async getFindings(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = repo.replace('-', '/');
    return this.securityScanner.getFindings(repoName, number);
  }

  @Get('report/:repo/:number')
  async getReport(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = repo.replace('-', '/');
    const report = await this.securityScanner.generateReport(repoName, number);
    return { report };
  }

  @Post('scan/:repo/:number')
  async scan(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    // In a real app, this would trigger an async scan
    return { status: 'queued' };
  }
}
