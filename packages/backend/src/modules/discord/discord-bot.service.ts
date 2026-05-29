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

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordBotService.name);
  private client: Client | null = null;
  private enabled = false;
  private token = '';
  private guildId = '';
  private voiceChannelId = '';
  private soundsDir = '';

  constructor(private configService: ConfigService) {
    const soundDisabled = process.env.DISCORD_SOUND_DISABLED === 'true';
    this.enabled = !soundDisabled && this.configService.get('DISCORD_BOT_ENABLED', false);
    this.token = this.configService.get('DISCORD_BOT_TOKEN', '');
    this.guildId = this.configService.get('DISCORD_GUILD_ID', '');
    this.voiceChannelId = this.configService.get('DISCORD_VOICE_CHANNEL_ID', '');
    const configured = this.configService.get<string>('DISCORD_SOUNDS_DIR', '');
    this.soundsDir = configured || path.join(PACKAGE_ROOT, 'sounds');
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
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates,
        ],
      });

      this.client.on('error', (err) => {
        this.logger.error(`Discord client error: ${err.message}`);
      });

      await this.client.login(this.token);

      await new Promise<void>((resolve) => {
        if (this.client!.isReady()) {
          resolve();
          return;
        }
        this.client!.once('ready', () => {
          resolve();
        });
      });

      this.logger.log(`Discord bot logged in as ${this.client?.user?.tag} (ready).`);
    } catch (error: any) {
      this.logger.error(`Failed to start Discord bot: ${error.message}`);
      this.client = null;
    }
  }

  async playSound(sound: 'approved' | 'rejected'): Promise<void> {
    if (!this.enabled || !this.client) return;

    const filePath = path.join(this.soundsDir, `${sound}.ogg`);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Sound file not found: ${filePath}, skipping playback.`);
      return;
    }

    if (!this.guildId || !this.voiceChannelId) {
      this.logger.warn('DISCORD_GUILD_ID or DISCORD_VOICE_CHANNEL_ID not configured.');
      return;
    }

    const guild = this.client.guilds.cache.get(this.guildId);
    if (!guild) {
      this.logger.warn(`Guild ${this.guildId} not found.`);
      return;
    }

    const channel = guild.channels.cache.get(this.voiceChannelId) as VoiceChannel;
    if (!channel) {
      this.logger.warn(`Voice channel ${this.voiceChannelId} not found in guild ${this.guildId}.`);
      return;
    }

    let connection: VoiceConnection | null = null;

    try {
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

      const player = createAudioPlayer();

      connection.subscribe(player);

      const resource = createAudioResource(filePath, { inputType: StreamType.OggOpus });
      player.play(resource);

      this.logger.log(`Playing ${sound}.ogg in #${channel.name}...`);

      await entersState(player, AudioPlayerStatus.Idle, 30_000).catch(() => {});
      this.logger.log(`Finished playing ${sound}.ogg in #${channel.name}.`);
    } catch (error: any) {
      this.logger.error(`Failed to play soundboard: ${error.message}`);
    } finally {
      if (connection) {
        connection.destroy();
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
