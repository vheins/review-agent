import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityScannerService } from './security-scanner.service.js';
import { DependencyScannerService } from './dependency-scanner.service.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityFinding]),
  ],
  providers: [SecurityScannerService, DependencyScannerService],
  exports: [SecurityScannerService, DependencyScannerService],
})
export class SecurityModule {}
