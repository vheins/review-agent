import { Logger } from '@nestjs/common';

/**
 * OpenCode CLI version-aware argument builder.
 *
 * OpenCode v1 (1.x) and v2 (2.x) have diverged CLI surfaces:
 *
 * | Concept        | v1 (1.x)                      | v2 (2.x)                 |
 * |----------------|-------------------------------|--------------------------|
 * | working dir    | `--dir <dir>`                 | removed (use process cwd)|
 * | auto-approve   | `--dangerously-skip-permissions` | `--auto`              |
 * | model variant  | `--variant <variant>`         | `--model <model>#<variant>` |
 *
 * Select the version explicitly with `OPENCODE_VERSION=v1|v2`, or leave it as
 * `auto` (default) to detect it from the installed binary.
 */
export type OpenCodeVersion = 'v1' | 'v2';

const logger = new Logger('OpenCodeUtil');
const versionCache = new Map<string, OpenCodeVersion>();

export type OpenCodeVersionRunner = (cmd: string, args: string[]) => Promise<string>;

/**
 * Parse the major version from `opencode --version` output.
 * v2 prints e.g. `opencode v2.0.20`, v1 prints e.g. `1.4.3`.
 */
export function parseOpenCodeVersion(raw: string): OpenCodeVersion {
  const match = String(raw).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return 'v1';
  return parseInt(match[1], 10) >= 2 ? 'v2' : 'v1';
}

/**
 * Resolve the effective OpenCode CLI version.
 *
 * Priority: explicit `OPENCODE_VERSION` env (`v1`/`v2`) > cached detection >
 * live detection via the provided runner (defaults to `v1` on failure).
 */
export async function resolveOpenCodeVersion(
  bin: string,
  runner: OpenCodeVersionRunner,
): Promise<OpenCodeVersion> {
  const configured = (process.env.OPENCODE_VERSION || 'auto').toLowerCase();
  if (configured === 'v1' || configured === 'v2') return configured;

  const cached = versionCache.get(bin);
  if (cached) return cached;

  let version: OpenCodeVersion = 'v1';
  try {
    const output = await runner(bin, ['--version']);
    version = parseOpenCodeVersion(output);
  } catch (error: any) {
    logger.warn(
      `Failed to detect OpenCode version for "${bin}" (${error?.message || error}); defaulting to v1`,
    );
  }

  versionCache.set(bin, version);
  logger.log(`Resolved OpenCode version for "${bin}": ${version}`);
  return version;
}

export interface OpenCodeRunArgsOptions {
  version: OpenCodeVersion;
  repoDir: string;
  model: string;
  agent?: string;
  variant?: string;
  prompt: string;
}

/**
 * Build the `opencode run` argument list for the given CLI version.
 */
export function buildOpenCodeRunArgs(opts: OpenCodeRunArgsOptions): string[] {
  const { version, repoDir, model, agent, variant, prompt } = opts;
  const args = ['run'];

  if (version === 'v1') {
    args.push('--dir', repoDir, '--thinking', '--dangerously-skip-permissions');
    if (variant) args.push('--variant', variant);
  } else {
    args.push('--thinking', '--auto');
  }

  if (model && model !== 'auto') {
    args.push('--model', version === 'v2' && variant ? `${model}#${variant}` : model);
  }

  if (agent) {
    args.push('--agent', agent);
  }

  args.push(prompt);
  return args;
}
