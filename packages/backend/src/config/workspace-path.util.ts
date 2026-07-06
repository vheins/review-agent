import path from 'path';
import { fileURLToPath } from 'url';

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CONFIG_DIR, '../../../../');

export function resolveWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR
    ? path.resolve(PROJECT_ROOT, process.env.WORKSPACE_DIR)
    : path.resolve(PROJECT_ROOT, 'workspace');
}
