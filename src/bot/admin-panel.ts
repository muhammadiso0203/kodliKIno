import { Telegraf, Context, Markup } from 'telegraf';
import { Movie } from 'src/entity/MovieEntity';
import { Repository } from 'typeorm';
import { RequiredChannel } from 'src/entity/requiredchannel.entity';
import { User } from 'src/entity/user.entity';

interface State {
  step:
    | 'waiting_code'
    | 'waiting_video'
    | 'waiting_edit_code'
    | 'waiting_delete_code'
    | 'waiting_channel'
    | 'waiting_channel_delete';
  code?: string;
  title?: string;
}
const broadcastStep = new Map<number, boolean>();
const addState = new Map<number, State>();
const forwardStep = new Set<number>();

export function setupAdminPanel(
  bot: Telegraf,
  movieRepo: Repository<Movie>,
  channelRepo: Repository<RequiredChannel>,
  userRepo: Repository<User>,
) {
  bot.command('admin', (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    ctx.reply(
      '🎬 Admin panel',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('➕ Kino qo‘shish', 'add_movie'),
          Markup.button.callback('♻️ Kino tahrirlash', 'edit_movie'),
          Markup.button.callback('📋 Kinolar ro‘yxati', 'view_movies'),
          Markup.button.callback('🗑 Kino o‘chirish', 'delete_movie'),
        ],
        [
          Markup.button.callback('📢 Kanal qo‘shish', 'add_channel'),
          Markup.button.callback('❌ Kanalni o‘chirish', 'delete_channel'),
          Markup.button.callback('📋 Kanallar ro‘yxati', 'list_channels'),
        ],
        [
          Markup.button.callback('📨 Forward xabar yuborish', 'forward_to_all'),
          Markup.button.callback('📢 Xabar yuborish', 'send_broadcast'),
          Markup.button.callback('📊 Statistika', 'view_stats'),
        ],
      ]),
    );
  });

  bot.action('forward_to_all', async (ctx) => {
    const userId = ctx.from.id;
    forwardStep.add(userId);

    await ctx.answerCbQuery();
    await ctx.reply('📨 Forward xabar yuboring.');
  });

  bot.action('send_broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    broadcastStep.set(userId, true);
    await ctx.reply('📨 Yubormoqchi bo‘lgan xabaringizni yuboring:');
  });

  bot.action('view_stats', async (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    await ctx.answerCbQuery();

    const userCount = await userRepo.count(); // 👥 Foydalanuvchilar soni
    const movieCount = await movieRepo.count(); // 🎬 Kinolar soni
    const channelCount = await channelRepo.count(); // 📢 Majburiy kanallar soni

    const message = `
📊 *Statistika:*
👥 Foydalanuvchilar: *${userCount}*
🎬 Kinolar: *${movieCount}*
📢 Majburiy kanallar: *${channelCount}*
`;

    return ctx.replyWithMarkdown(message);
  });

  bot.action('list_channels', async (ctx) => {
    await ctx.answerCbQuery(); // ❗ Har doim birinchi bo‘lishi kerak

    const channels = await channelRepo.find();

    if (channels.length === 0) {
      return ctx.reply('📭 Kanallar ro‘yxati bo‘sh.');
    }

    // Oddiy matn sifatida chiqaramiz
    const list = channels.map((ch, i) => `${i + 1}. ${ch.username}`).join('\n');

    return ctx.reply(`📋 Majburiy kanallar ro‘yxati:\n\n${list}`);
  });

  bot.action('delete_channel', async (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    await ctx.answerCbQuery();

    const channels = await channelRepo.find();

    if (!channels.length) {
      return ctx.reply('📭 Hozircha hech qanday kanal mavjud emas.');
    }

    const buttons = channels.map((ch) => [
      Markup.button.callback(
        `❌ ${ch.username}`,
        `confirm_delete_channel:${ch.id}`,
      ),
    ]);

    return ctx.reply(
      '🗑 O‘chirmoqchi bo‘lgan kanalni tanlang:',
      Markup.inlineKeyboard(buttons),
    );
  });

  bot.action(/^confirm_delete_channel:(\d+)$/, async (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    await ctx.answerCbQuery();

    const channelId = Number(ctx.match[1]);
    const channel = await channelRepo.findOne({ where: { id: channelId } });

    if (!channel) {
      return ctx.reply('❌ Kanal topilmadi yoki allaqachon o‘chirilgan.');
    }

    await channelRepo.remove(channel);
    return ctx.reply(`✅ Kanal o‘chirildi: ${channel.username}`);
  });

  bot.action('add_channel', async (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    await ctx.answerCbQuery(); // 🟢 Telegram javob kutmasin
    ctx.reply("📨 Kanal username'ni yuboring. Masalan: `@mychannel`", {
      parse_mode: 'Markdown',
    });

    // Statega kanal qo‘shish jarayonini eslab qolamiz
    addState.set(id, { step: 'waiting_channel' });
  });

  bot.action('delete_movie', (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    addState.set(id, { step: 'waiting_delete_code' });
    ctx.answerCbQuery();
    ctx.reply('🗑 O‘chirish uchun kino kodini yuboring:');
  });

  bot.action('view_movies', async (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    ctx.answerCbQuery();

    const movies = await movieRepo.find(); // 📥 DB'dan kino olish

    if (movies.length === 0) {
      return ctx.reply('📭 Kinolar ro‘yxati bo‘sh.');
    }

    const list = movies
      .map((m, i) => `${i + 1}. *${m.code}* — ${m.title}`)
      .slice(0, 100)
      .join('\n');

    ctx.replyWithMarkdown(`🎬 *Kinolar ro‘yxati (1–100)*\n\n${list}`);
  });

  bot.action('add_movie', (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    addState.set(id, { step: 'waiting_code' });
    ctx.answerCbQuery();
    ctx.reply('🔡 Kod va nomni kiriting: `KOD Kino nomi`');
  });

  bot.action('edit_movie', (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    addState.set(id, { step: 'waiting_edit_code' });
    ctx.answerCbQuery();
    ctx.reply('✏️ Tahrirlash uchun kino kodini yuboring.');
  });

  bot.on('text', async (ctx, next) => {
    const id = ctx.from?.id;
    const state = addState.get(id || 0);
    const text = ctx.message.text.trim();

    if (state?.step === 'waiting_code') {
      const [code, ...rest] = text.split(' ');
      const title = rest.join(' ');
      if (!code || !title) return ctx.reply('❌ Format: `KOD Kino nomi`');

      addState.set(id!, { step: 'waiting_video', code, title });
      return ctx.reply('📥 Endi video yuboring.');
    }

    if (state?.step === 'waiting_edit_code') {
      const movie = await movieRepo.findOne({ where: { code: text } });
      if (!movie) return ctx.reply('❌ Kino topilmadi.');

      addState.set(id!, {
        step: 'waiting_video',
        code: movie.code,
        title: movie.title,
      });

      return ctx.reply(`🎬 Yangi videoni yuboring: ${movie.title}`);
    }

    if (state?.step === 'waiting_delete_code') {
      const code = text;

      // 📌 BAZADAN QIDIRISH
      const movie = await movieRepo.findOne({ where: { code } });

      if (!movie) {
        return ctx.reply('❌ Bunday koddagi kino topilmadi.');
      }

      // ✅ O‘CHIRISH
      await movieRepo.remove(movie);

      addState.delete(id!);

      return ctx.reply(`✅ Kino o‘chirildi: ${movie.title} (${movie.code})`);
    }

    if (state?.step === 'waiting_channel') {
      if (!text.startsWith('@')) {
        return ctx.reply('❌ Kanal username @ bilan boshlanishi kerak.');
      }

      // Bazaga yozish
      const existing = await channelRepo.findOne({ where: { username: text } });

      if (existing) {
        return ctx.reply('⚠️ Bu kanal ro‘yxatda mavjud.');
      }

      const channel = channelRepo.create({ username: text });
      await channelRepo.save(channel);

      addState.delete(id!);
      return ctx.reply(`✅ Kanal qo‘shildi: ${text}`);
    }

    if (state?.step === 'waiting_channel_delete') {
      if (!text.startsWith('@')) {
        return ctx.reply('❌ Kanal username @ bilan boshlanishi kerak.');
      }

      const channel = await channelRepo.findOne({ where: { username: text } });

      if (!channel) {
        return ctx.reply('⚠️ Bunday kanal topilmadi.');
      }

      await channelRepo.remove(channel);
      addState.delete(id!);

      return ctx.reply(`✅ Kanal o‘chirildi: ${text}`);
    }

    // 🔄 Broadcast xabari yuborish bosqichi
    if (broadcastStep.has(id)) {
      const message = ctx.message.text;

      const users = await userRepo.find(); // Barcha foydalanuvchilar

      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.id, message);
        } catch (err) {
          console.warn(`❌ Xabar yuborilmadi: ${user.id}`, err.message);
        }
      }

      await ctx.reply('✅ Xabar barcha foydalanuvchilarga yuborildi.');
      broadcastStep.delete(id);
      return;
    }

    return next();
  });

  bot.on('video', async (ctx) => {
    const id = ctx.from?.id;
    const state = addState.get(id || 0);
    const file_id = ctx.message.video.file_id;

    if (
      state?.step === 'waiting_video' &&
      state.code &&
      state.title &&
      file_id
    ) {
      const old = await movieRepo.findOne({ where: { code: state.code } });

      if (old) {
        old.file_id = file_id;
        await movieRepo.save(old);
        ctx.reply(`✅ Kino yangilandi: ${old.title}`);
      } else {
        const newMovie = movieRepo.create({
          code: state.code,
          title: state.title,
          file_id,
        });
        await movieRepo.save(newMovie);
        ctx.reply(`✅ Yangi kino saqlandi: ${newMovie.title}`);
      }

      addState.delete(id!);
    }
  });

  bot.on('message', async (ctx) => {
    const userId = ctx.from.id;

    // Forward step bo‘lsa
    if (forwardStep.has(userId)) {
      forwardStep.delete(userId); // step tugadi

      const users = await userRepo.find(); // Barcha obunachilar
      let success = 0,
        fail = 0;

      for (const user of users) {
        try {
          await ctx.telegram.forwardMessage(
            user.id,
            ctx.chat.id,
            ctx.message.message_id,
          );
          success++;
        } catch (err) {
          fail++;
          console.warn(`❌ ${user.id} ga yuborilmadi`);
        }
      }

      return ctx.reply(
        `✅ Forward xabar yuborildi\n🟢 Yuborildi: ${success} ta\n🔴 Xatolik: ${fail} ta`,
      );
    }
  });
}
