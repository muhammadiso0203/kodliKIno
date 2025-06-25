import { Injectable } from '@nestjs/common';
import { Context, Markup, Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import {
  setupAdminPanel,
  findMovieByCode,
  users,
  saveUsers,
} from './admin-panel.js';
import { join, resolve } from 'path';
import { readFileSync } from 'fs';

dotenv.config();

const requiredChannelPath = resolve('data', 'required_channel.json');


// 📦 Kanal nomini xavfsiz o‘qish
let channel: string = '';

try {
  const data = JSON.parse(readFileSync(requiredChannelPath, 'utf8'));
  if (typeof data.channel === 'string' && data.channel.startsWith('@')) {
    channel = data.channel;
  } else {
    console.warn('⚠️ Kanal nomi noto‘g‘ri yoki yo‘q:', data.channel);
  }
} catch (err) {
  console.error('❌ Kanal faylini o‘qishda xatolik:', err);
}

// 🔍 Obuna tekshirish funksiyasi
export async function isUserMember(
  bot: Telegraf<any>,
  channel: string,
  userId: number,
): Promise<boolean> {
  try {
    if (!channel || typeof channel !== 'string' || !channel.startsWith('@')) {
      console.warn('⚠️ Kanal nomi noto‘g‘ri:', channel);
      return false;
    }

    const member = await bot.telegram.getChatMember(channel, userId);
    return ['member', 'creator', 'administrator'].includes(member.status);
  } catch (error) {
    console.error(`❌ getChatMember xatolik (${channel}):`, error);
    return false;
  }
}

@Injectable()
export class BotService {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(process.env.BOT_TOKEN!);

    // 🛠 Admin panel ulash
    setupAdminPanel(this.bot);

    // ▶️ /start
    this.bot.start(async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      // ❗ Kanal belgilanmagan bo‘lsa
      if (!channel) {
        return ctx.reply(
          '⚠️ Kanal sozlanmagan. Admin kanalni qo‘shishi kerak.',
        );
      }

      const isMember = await isUserMember(this.bot, channel, userId);

      if (!isMember) {
        return ctx.reply(
          '👋 Botdan foydalanish uchun quyidagi kanalga obuna bo‘ling:',
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

      // ✅ Obuna bo‘lgan
      ctx.reply('✅ Xush kelibsiz! Kino kodini yuboring.');
    });

    // 🔄 Obuna qayta tekshirish
    this.bot.action('check_subscription', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const isMember = await isUserMember(this.bot, channel, userId);

      if (!isMember) {
        return ctx.reply(
          '🚫 Siz hali ham kanalga obuna bo‘lmagansiz. Iltimos, obuna bo‘ling:',
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

      ctx.reply(
        '✅ Tabriklaymiz! Endi botdan foydalanishingiz mumkin. Kino kodini yuboring.',
      );
    });

    // 🔎 Foydalanuvchi kino kodi yuboradi
    this.bot.on('text', (ctx) => {
      const userId = ctx.from?.id;
      if (userId && !users.includes(userId)) {
        users.push(userId);
        saveUsers();
      }

      const code = ctx.message.text.trim();
      const movie = findMovieByCode(code);

      if (movie) {
        return ctx.replyWithVideo(movie.file_id, {
          caption: `🎬 ${movie.title}`,
        });
      } else {
        return ctx.reply('❌ Bunday koddagi kino topilmadi.');
      }
    });
  }

  // 🚀 Botni ishga tushirish
  async launch() {
    await this.bot.launch();
  }

  // ⛔ Botni to‘xtatish
  async stop(reason: string) {
    await this.bot.stop(reason);
  }
}
