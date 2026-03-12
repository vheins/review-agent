import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);

  /**
   * Parse LCOV content to get coverage percentage
   * 
   * @param lcovContent - LCOV file content
   * @returns Coverage percentage (0-100)
   */
  async parseLcov(lcovContent: string): Promise<number> {
    // LCOV format: SF:path/to/file, DA:line,count, LF:total, LH:covered
    const lines = lcovContent.split('\n');
    let totalLH = 0;
    let totalLF = 0;

    for (const line of lines) {
      if (line.startsWith('LH:')) {
        totalLH += parseInt(line.split(':')[1], 10);
      } else if (line.startsWith('LF:')) {
        totalLF += parseInt(line.split(':')[1], 10);
      }
    }

    return totalLF > 0 ? (totalLH / totalLF) * 100 : 0;
  }
}
