export interface RuntimeFlags {
  noSound: boolean;
}

export function applyRuntimeFlags(argv: string[] = process.argv.slice(2)): RuntimeFlags {
  const noSound = argv.includes('--no-sound');

  if (noSound) {
    process.env.DISCORD_SOUND_DISABLED = 'true';
  }

  return { noSound };
}
