import path from 'path';
import { fileURLToPath } from 'url';

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKSPACE_DIR = path.resolve(CONFIG_DIR, '../../../../workspace');

export function resolveWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || DEFAULT_WORKSPACE_DIR;
}
