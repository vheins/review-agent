import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  Inject,
} from '@nestjs/common';
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
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import ffmpegPath from 'ffmpeg-static';

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

  private ttsMuteStartHour: number;
  private ttsMuteEndHour: number;

  constructor(@Optional() @Inject(ConfigService) private configService?: ConfigService) {
    const soundDisabled = process.env.DISCORD_SOUND_DISABLED === 'true';
    this.enabled =
      !soundDisabled && (this.configService?.get('DISCORD_BOT_ENABLED', false) ?? false);
    this.token = this.configService?.get('DISCORD_BOT_TOKEN', '') ?? '';
    this.guildId = this.configService?.get('DISCORD_GUILD_ID', '') ?? '';
    this.voiceChannelId = this.configService?.get('DISCORD_VOICE_CHANNEL_ID', '') ?? '';
    const configured = this.configService?.get<string>('DISCORD_SOUNDS_DIR', '') ?? '';
    this.soundsDir = configured || path.join(PACKAGE_ROOT, 'sounds');
    this.ttsApiUrl =
      this.configService?.get('TTS_API_URL', 'http://localhost:20128/v1/audio/speech') ??
      'http://localhost:20128/v1/audio/speech';
    this.ttsApiKey = this.configService?.get('TTS_API_KEY', '') ?? '';
    this.ttsMuteStartHour = parseInt(
      this.configService?.get('TTS_MUTE_START_HOUR', '9') ?? '9',
      10,
    );
    this.ttsMuteEndHour = parseInt(this.configService?.get('TTS_MUTE_END_HOUR', '10') ?? '10', 10);
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
    if (this.isTtsMuteHour()) {
      this.logger.log(
        `Sound muted (${label}) — active hours ${this.ttsMuteStartHour}:00-${this.ttsMuteEndHour}:00.`,
      );
      return;
    }
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

  get hasTts(): boolean {
    return !!this.ttsApiKey;
  }

  isTtsMuteHour(): boolean {
    const hour = new Date().getHours();
    if (this.ttsMuteStartHour < this.ttsMuteEndHour) {
      return hour >= this.ttsMuteStartHour && hour < this.ttsMuteEndHour;
    }
    return hour >= this.ttsMuteStartHour || hour < this.ttsMuteEndHour;
  }

  /** Indonesian TTS (default) */
  async playTTS(text: string): Promise<boolean> {
    return this._generateTTS(text, 'edge-tts/id-ID-ArdiNeural', 'id');
  }

  /** English TTS (en-GB-RyanNeural) */
  async playTTSEnglish(text: string): Promise<boolean> {
    return this._generateTTS(text, 'edge-tts/en-GB-RyanNeural', 'en');
  }

  private async _generateTTS(text: string, model: string, lang: string): Promise<boolean> {
    if (!this.ttsApiKey) {
      this.logger.warn('TTS_API_KEY not set, skipping TTS announcement.');
      return false;
    }

    const fallbackModel = 'google-tts/id';
    const models = model !== fallbackModel ? [model, fallbackModel] : [model];

    for (const currentModel of models) {
      if (await this._tryGenerateTTS(text, currentModel, lang)) {
        return true;
      }
      if (currentModel !== fallbackModel) {
        this.logger.warn(`TTS model "${currentModel}" gagal, fallback ke "${fallbackModel}".`);
      }
    }

    return false;
  }

  private async _tryGenerateTTS(text: string, model: string, lang: string): Promise<boolean> {
    const textHash = createHash('sha256').update(`${model}:${text}`).digest('hex').slice(0, 16);
    const cachedOgg = path.join(this.soundsDir, `__tts_cache_${lang}_${textHash}.ogg`);

    try {
      if (fs.existsSync(cachedOgg) && fs.statSync(cachedOgg).size > 0) {
        this.logger.debug(`TTS cache hit: ${cachedOgg}`);
        await this.playOggFile(cachedOgg, `TTS(${lang}): "${text.slice(0, 60)}..."`);
        return true;
      }

      const tmpFile = path.join(this.soundsDir, `__tts_temp_${lang}.mp3`);

      const url = new URL(this.ttsApiUrl);
      url.searchParams.set('response_format', 'json');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.ttsApiKey}`,
        },
        body: JSON.stringify({ model, input: text }),
      });

      if (!response.ok) {
        this.logger.warn(`TTS API returned status ${response.status} for model "${model}".`);
        return false;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = (await response.json()) as any;
        const audioBase64 =
          json.audio || json.data || json.base64 || (typeof json === 'string' ? json : null);
        if (!audioBase64) {
          this.logger.warn(`TTS API returned JSON without audio field for model "${model}".`);
          return false;
        }
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        await fs.promises.writeFile(tmpFile, audioBuffer);
      } else {
        const arrayBuffer = await response.arrayBuffer();
        await fs.promises.writeFile(tmpFile, Buffer.from(arrayBuffer));
      }

      if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size === 0) {
        this.logger.warn(`TTS API returned empty audio for model "${model}".`);
        return false;
      }

      await execa(ffmpegPath, [
        '-y',
        '-i',
        tmpFile,
        '-ac',
        '1',
        '-c:a',
        'libopus',
        '-b:a',
        '24k',
        cachedOgg,
      ]);

      await fs.promises.unlink(tmpFile).catch(() => {});

      await this.playOggFile(cachedOgg, `TTS(${lang}): "${text.slice(0, 60)}..."`);
      return true;
    } catch (error: any) {
      this.logger.warn(`TTS playback failed for model "${model}": ${error.message}`);
      return false;
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
