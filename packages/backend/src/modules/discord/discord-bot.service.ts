import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits, VoiceChannel } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} from '@discordjs/voice';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { execa } from 'execa';

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordBotService.name);
  private client: Client | null = null;
  private _ready = false;
  private enabled = false;
  private token = '';
  private guildId = '';
  private voiceChannelId = '';
  private soundsDir = '';
  private ttsApiUrl = '';
  private ttsApiKey = '';

  constructor(private configService: ConfigService) {
    const soundDisabled = process.env.DISCORD_SOUND_DISABLED === 'true';
    this.enabled = !soundDisabled && this.configService.get('DISCORD_BOT_ENABLED', false);
    this.token = this.configService.get('DISCORD_BOT_TOKEN', '');
    this.guildId = this.configService.get('DISCORD_GUILD_ID', '');
    this.voiceChannelId = this.configService.get('DISCORD_VOICE_CHANNEL_ID', '');
    const configured = this.configService.get<string>('DISCORD_SOUNDS_DIR', '');
    this.soundsDir = configured || path.join(PACKAGE_ROOT, 'sounds');
    this.ttsApiUrl = this.configService.get(
      'TTS_API_URL',
      'http://localhost:20128/v1/audio/speech',
    );
    this.ttsApiKey = this.configService.get('TTS_API_KEY', '');
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      const reason = process.env.DISCORD_SOUND_DISABLED === 'true' ? '--no-sound flag' : 'config';
      this.logger.log(`Discord bot disabled via ${reason}.`);
      return;
    }

    if (!this.token) {
      this.logger.warn('DISCORD_BOT_TOKEN not set — Discord bot disabled.');
      return;
    }

    try {
      this.client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      });

      this.client.on('error', err => {
        this.logger.error(`Discord client error: ${err.message}`);
      });

      await this.client.login(this.token);

      await new Promise<void>(resolve => {
        if (this.client!.isReady()) {
          resolve();
          return;
        }
        this.client!.once('ready', () => {
          resolve();
        });
      });

      this.logger.log(`Discord bot logged in as ${this.client?.user?.tag} (ready).`);
      this._ready = true;
    } catch (error: any) {
      this.logger.error(`Failed to start Discord bot: ${error.message}`);
      this.client = null;
    }
  }

  async waitForReady(timeoutMs = 15_000): Promise<boolean> {
    if (this._ready) return true;
    const start = Date.now();
    while (!this._ready && Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return this._ready;
  }

  private async getVoiceChannel(): Promise<{ guild: any; channel: VoiceChannel } | null> {
    if (!this.enabled || !this.client) return null;
    if (!this.guildId || !this.voiceChannelId) {
      this.logger.warn('DISCORD_GUILD_ID or DISCORD_VOICE_CHANNEL_ID not configured.');
      return null;
    }

    const guild = this.client.guilds.cache.get(this.guildId);
    if (!guild) {
      this.logger.warn(`Guild ${this.guildId} not found.`);
      return null;
    }

    const channel = guild.channels.cache.get(this.voiceChannelId) as VoiceChannel;
    if (!channel) {
      this.logger.warn(`Voice channel ${this.voiceChannelId} not found in guild ${this.guildId}.`);
      return null;
    }

    return { guild, channel };
  }

  private async playOggFile(filePath: string, label: string): Promise<void> {
    const vc = await this.getVoiceChannel();
    if (!vc) return;
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Sound file not found: ${filePath}, skipping playback.`);
      return;
    }

    let connection: VoiceConnection | null = null;
    try {
      connection = joinVoiceChannel({
        channelId: vc.channel.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

      const player = createAudioPlayer();
      connection.subscribe(player);

      const resource = createAudioResource(filePath, { inputType: StreamType.OggOpus });
      player.play(resource);

      this.logger.log(`Playing ${label} in #${vc.channel.name}...`);

      await entersState(player, AudioPlayerStatus.Idle, 30_000).catch(() => {});
      this.logger.log(`Finished playing ${label} in #${vc.channel.name}.`);
    } catch (error: any) {
      this.logger.error(`Failed to play audio: ${error.message}`);
    } finally {
      if (connection) connection.destroy();
    }
  }

  async playSound(sound: 'approved' | 'rejected'): Promise<void> {
    const filePath = path.join(this.soundsDir, `${sound}.ogg`);
    await this.playOggFile(filePath, `${sound}.ogg`);
  }

  async playTTS(text: string): Promise<void> {
    if (!this.ttsApiKey) {
      this.logger.warn('TTS_API_KEY not set, skipping TTS announcement.');
      return;
    }

    const tmpFile = path.join(this.soundsDir, `__tts_temp.mp3`);
    const oggFile = path.join(this.soundsDir, `__tts_temp.ogg`);

    try {
      await execa('curl', [
        '-s',
        '-X',
        'POST',
        this.ttsApiUrl,
        '-H',
        'Content-Type: application/json',
        '-H',
        `Authorization: Bearer ${this.ttsApiKey}`,
        '-d',
        JSON.stringify({ model: 'edge-tts/id-ID-ArdiNeural', input: text }),
        '--output',
        tmpFile,
      ]);

      if (!fs.existsSync(tmpFile)) {
        this.logger.warn('TTS API returned no audio file, skipping playback.');
        return;
      }

      await execa('ffmpeg', [
        '-y',
        '-i',
        tmpFile,
        '-ac',
        '1',
        '-c:a',
        'libopus',
        '-b:a',
        '24k',
        oggFile,
      ]);

      await this.playOggFile(oggFile, `TTS: "${text.slice(0, 60)}..."`);
    } catch (error: any) {
      this.logger.warn(`TTS playback failed: ${error.message}`);
    } finally {
      for (const f of [tmpFile, oggFile]) {
        fs.unlink(f, () => {});
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      this.logger.log('Destroying Discord client...');
      this.client.destroy();
      this.client = null;
    }
  }
}
