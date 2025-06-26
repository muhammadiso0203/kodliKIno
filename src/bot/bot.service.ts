import { Injectable } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from 'src/entity/MovieEntity';
import { User } from '../entity/user.entity';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import { setupAdminPanel } from './admin-panel';
import { RequiredChannel } from 'src/entity/requiredchannel.entity';

dotenv.config();

const requiredChannelPath = resolve('data', 'required_channel.json');
let channel = '';

try {
  const data = JSON.parse(readFileSync(requiredChannelPath, 'utf8'));
  if (typeof data.channel === 'string' && data.channel.startsWith('@')) {
    channel = data.channel;
  } else {
    console.warn('⚠️ Kanal noto‘g‘ri:', data.channel);
  }
} catch (err) {
  console.error('❌ Kanal faylini o‘qishda xatolik:', err);
}

async function isUserMember(
  bot: Telegraf<any>,
  channel: string,
  userId: number,
) {
  try {
    if (!channel.startsWith('@')) return false;
    const member = await bot.telegram.getChatMember(channel, userId);
    return ['member', 'creator', 'administrator'].includes(member.status);
  } catch {
    return false;
  }
}

@Injectable()
export class BotService {
  private bot: Telegraf;

  constructor(
    @InjectRepository(Movie)
    private movieRepo: Repository<Movie>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RequiredChannel)
    private channelRepo: Repository<RequiredChannel>,
  ) {
    this.bot = new Telegraf(process.env.BOT_TOKEN!);
    setupAdminPanel(this.bot, this.movieRepo);
    this.bot.start(async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      if (!channel) {
        return ctx.reply('⚠️ Kanal sozlanmagan.');
      }

      const isMember = await isUserMember(this.bot, channel, userId);
      if (!isMember) {
        return ctx.reply(
          '👋 Botdan foydalanish uchun kanalga obuna bo‘ling:',
          Markup.inlineKeyboard([
            [
              Markup.button.url(
                '🔗 Obuna bo‘lish',
                `https://t.me/${channel.replace('@', '')}`,
              ),
            ],
            [Markup.button.callback("✅ A'zo bo‘ldim", 'check_subscription')],
          ]),
        );
      }

      ctx.reply('✅ Xush kelibsiz! Kino kodini yuboring.');
    });

    this.bot.action('check_subscription', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const isMember = await isUserMember(this.bot, channel, userId);
      if (!isMember) {
        return ctx.reply(
          '🚫 Hali obuna bo‘lmagansiz.',
          Markup.inlineKeyboard([
            [
              Markup.button.url(
                '🔗 Obuna bo‘lish',
                `https://t.me/${channel.replace('@', '')}`,
              ),
            ],
            [Markup.button.callback("✅ A'zo bo‘ldim", 'check_subscription')],
          ]),
        );
      }

      ctx.reply('✅ Tabriklaymiz! Endi botdan foydalanishingiz mumkin.');
    });

    this.bot.on('text', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const exists = await this.userRepo.findOne({ where: { id: userId } });
      if (!exists) {
        await this.userRepo.save({ id: userId });
      }

      const code = ctx.message.text.trim();
      const movie = await this.movieRepo.findOne({ where: { code } });

      if (movie) {
        return ctx.replyWithVideo(movie.file_id, {
          caption: `🎬 ${movie.title}`,
        });
      } else {
        return ctx.reply('❌ Bunday koddagi kino topilmadi.');
      }
    });
  }

  async launch() {
    await this.bot.launch();
  }

  async stop(reason: string) {
    await this.bot.stop(reason);
  }
}
