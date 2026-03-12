import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityScannerService } from './security-scanner.service.js';
import { DependencyScannerService } from './dependency-scanner.service.js';
import { LicenseScannerService } from './license-scanner.service.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';

import { SecurityController } from './security.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityFinding]),
  ],
  controllers: [SecurityController],
  providers: [SecurityScannerService, DependencyScannerService, LicenseScannerService],
  exports: [SecurityScannerService, DependencyScannerService, LicenseScannerService],
})
export class SecurityModule {}
