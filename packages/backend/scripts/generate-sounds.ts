import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

const SOUNDS_DIR = path.resolve(import.meta.dirname, '..', 'sounds');

const SOUNDS: Record<string, { freq: number; duration: number; description: string }> = {
  'approved.ogg': { freq: 880, duration: 0.3, description: 'Approved (high-pitch beep)' },
  'rejected.ogg': { freq: 220, duration: 0.5, description: 'Rejected (low-pitch buzz)' },
};

async function findFfmpeg(): Promise<string | null> {
  const candidates = [
    'ffmpeg',
    path.resolve(import.meta.dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    path.resolve(import.meta.dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
  ];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} -version`, { stdio: 'ignore' });
      return cmd;
    } catch {
      continue;
    }
  }

  for (const entry of fs.readdirSync(path.resolve(import.meta.dirname, '..', 'node_modules', 'ffmpeg-static'), { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.startsWith('ffmpeg'))) {
      return path.resolve(import.meta.dirname, '..', 'node_modules', 'ffmpeg-static', entry.name);
    }
  }

  return null;
}

async function main() {
  if (!fs.existsSync(SOUNDS_DIR)) {
    fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  }

  const ffmpeg = await findFfmpeg();

  if (!ffmpeg) {
    console.error('ffmpeg not found. Install ffmpeg or ffmpeg-static package.');
    console.error('Create sound files manually in:', SOUNDS_DIR);
    console.error('Required: approved.ogg, rejected.ogg');
    process.exit(1);
  }

  console.log(`Using ffmpeg: ${ffmpeg}`);
  console.log(`Generating sounds in: ${SOUNDS_DIR}\n`);

  for (const [filename, config] of Object.entries(SOUNDS)) {
    const outPath = path.join(SOUNDS_DIR, filename);
    const cmd = `${ffmpeg} -f lavfi -i "sine=frequency=${config.freq}:duration=${config.duration}" -ac 1 -acodec libopus -b:a 24k "${outPath}" -y`;

    try {
      execSync(cmd, { stdio: 'pipe' });
      const size = fs.statSync(outPath).size;
      console.log(`  ✓ ${filename}  (${(size / 1024).toFixed(1)} KB) — ${config.description}`);
    } catch (err: any) {
      console.error(`  ✗ ${filename} failed: ${err.message}`);
    }
  }

  console.log('\nDone.');
}

main();
