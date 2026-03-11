import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DataExporterService } from '../src/common/exporter/data-exporter.service.js';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('DataExporterService', () => {
  let service: DataExporterService;
  let configService: any;
  const testWorkspace = './test-exports-workspace';

  beforeEach(async () => {
    vi.clearAllMocks();
    configService = {
      getAppConfig: vi.fn().mockReturnValue({
        workspaceDir: testWorkspace,
      }),
    };
    service = new DataExporterService(configService as any);
  });

  afterEach(async () => {
    if (await fs.pathExists(testWorkspace)) {
      await fs.remove(testWorkspace);
    }
  });

  it('should export data to JSON correctly', async () => {
    const data = [{ a: 1, b: 2 }];
    const result = await service.exportData(data, 'test', 'json');

    expect(result.fileName).toContain('test');
    expect(result.fileName).toContain('.json');
    
    const content = await fs.readJson(result.filePath);
    expect(content).toEqual(data);
  });

  it('should export data to CSV correctly', async () => {
    const data = [{ name: 'Alice', age: 30 }];
    const result = await service.exportData(data, 'test', 'csv');

    expect(result.fileName).toContain('.csv');
    
    const content = await fs.readFile(result.filePath, 'utf8');
    expect(content).toContain('"name","age"');
    expect(content).toContain('"Alice",30');
  });

  it('should cleanup old exports', async () => {
    const data = [{}];
    const result = await service.exportData(data, 'old', 'json');
    
    // Manually set old mtime
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    await fs.utimes(result.filePath, oldDate, oldDate);

    const count = await service.cleanupOldExports(7);
    expect(count).toBe(1);
    expect(await fs.pathExists(result.filePath)).toBe(false);
  });
});
