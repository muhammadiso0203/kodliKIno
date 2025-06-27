import { Injectable } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from 'src/entity/MovieEntity';
import { User } from '../entity/user.entity';
import { setupAdminPanel } from './admin-panel';
import { RequiredChannel } from 'src/entity/requiredchannel.entity';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class BotService {
  private bot: Telegraf;
  private channel = ''; // ← Bazadan o‘qilgan kanal nomi

  constructor(
    @InjectRepository(Movie)
    private movieRepo: Repository<Movie>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RequiredChannel)
    private channelRepo: Repository<RequiredChannel>,
  ) {
    this.bot = new Telegraf(process.env.BOT_TOKEN!);
    this.init(); // Asosiy ishlarni boshlaymiz
  }

  private async init() {
    await this.loadChannelFromDb();

    // 🔧 Admin panelni o‘rnatamiz
    setupAdminPanel(this.bot, this.movieRepo, this.channelRepo, this.userRepo);

    // 🚀 start buyrug‘i
    this.bot.start(async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      if (!this.channel) {
        return ctx.reply('Assalomu alaykum. Kino kodini yunoring 🎬');
      }

      const isMember = await isUserMember(this.bot, this.channel, userId);
      if (!isMember) {
        return ctx.reply(
          '👋 Botdan foydalanish uchun kanalga obuna bo‘ling:',
          Markup.inlineKeyboard([
            [
              Markup.button.url(
                '🔗 Obuna bo‘lish',
                `https://t.me/${this.channel.replace('@', '')}`,
              ),
            ],
            [Markup.button.callback("✅ A'zo bo‘ldim", 'check_subscription')],
          ]),
        );
      }

      ctx.reply('✅ Xush kelibsiz! Kino kodini yuboring.');
    });

    // ✅ Obunani tekshirish
    this.bot.action('check_subscription', async (ctx) => {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      if (!userId) return;

      const isMember = await isUserMember(this.bot, this.channel, userId);
      if (!isMember) {
        return ctx.reply(
          '🚫 Hali obuna bo‘lmagansiz.',
          Markup.inlineKeyboard([
            [
              Markup.button.url(
                '🔗 Obuna bo‘lish',
                `https://t.me/${this.channel.replace('@', '')}`,
              ),
            ],
            [Markup.button.callback("✅ A'zo bo‘ldim", 'check_subscription')],
          ]),
        );
      }

      ctx.reply('✅ Tabriklaymiz! Endi botdan foydalanishingiz mumkin.');
    });

    // 🎬 Kino kodini qabul qilish
    this.bot.on('text', async (ctx) => {
      const userId = String(ctx.from?.id);
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

  private async loadChannelFromDb() {
    try {
      const allChannels = await this.channelRepo.find();
      if (allChannels.length > 0) {
        const firstChannel = allChannels[0].username;

        if (typeof firstChannel === 'string' && firstChannel.startsWith('@')) {
          this.channel = firstChannel;
          console.log('✅ Kanal o‘qildi:', this.channel);
        } else {
          console.warn('⚠️ Kanal noto‘g‘ri:', firstChannel);
        }
      } else {
        console.warn('⚠️ Kanal topilmadi. Bazada kanal yo‘q.');
      }
    } catch (err) {
      console.error('❌ Kanalni bazadan o‘qishda xatolik:', err);
    }
  }

  async launch() {
    await this.bot.launch();
  }

  async stop(reason: string) {
    await this.bot.stop(reason);
  }
}

// 🔍 Foydalanuvchi obuna bo‘lganligini tekshiruvchi funksiya
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
