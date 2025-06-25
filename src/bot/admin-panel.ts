import { Telegraf, Context, Markup } from 'telegraf';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Movie {
  code: string;
  title: string;
  file_id: string;
}

const adminsPath = join('data', 'admins.json');
const moviesPath = join('data', 'movies.json');
const usersPath = join('data', 'users.json');
const requiredChannelPath = join('data', 'required_channel.json');

let requiredData = JSON.parse(readFileSync(requiredChannelPath, 'utf8'));
let users: number[] = JSON.parse(readFileSync(usersPath, 'utf-8'));
let admins: number[] = JSON.parse(readFileSync(adminsPath, 'utf8'));
let movies: Movie[] = JSON.parse(readFileSync(moviesPath, 'utf8'));

let requiredChannels: string[] = requiredData.channels || [];

function saveUsers() {
  writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
}
function saveChannels() {
  writeFileSync(
    requiredChannelPath,
    JSON.stringify({ channels: requiredChannels }, null, 2),
    'utf8',
  );
}

// Admin panel sessiyalari
const addState = new Map<
  number,
  {
    step:
      | 'waiting_code'
      | 'waiting_video'
      | 'waiting_delete_code'
      | 'waiting_add_channel'
      | 'waiting_remove_channel'
      | 'waiting_broadcast_message'
      | 'waiting_new_admin'
      | 'waiting_remove_admin'
      | 'waiting_edit_code';

    code?: string;
    title?: string;
  }
>();

function saveMovies() {
  writeFileSync(moviesPath, JSON.stringify(movies, null, 2), 'utf8');
}

export function setupAdminPanel(bot: Telegraf<Context>) {
  // 🔐 Admin panel
  bot.command('admin', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return ctx.reply('❌ Siz admin emassiz.');

    return ctx.reply(
      '🛠 Admin Panel',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('➕ Kino qo‘shish', 'add_movie'),
          Markup.button.callback('🗑 Kino o‘chirish', 'delete_movie'),
          Markup.button.callback('📋 Kinolar ro‘yxati', 'view_movies'),
        ],
        [
          Markup.button.callback('➕ Admin qo‘shish', 'add_admin'),
          Markup.button.callback('🗑 Adminni o‘chirish', 'remove_admin'),
          Markup.button.callback('📋 Adminlar ro‘yxati', 'list_admins'),
        ],
        [
          Markup.button.callback('➕ Kanal qo‘shish', 'add_channel'),
          Markup.button.callback('🗑 Kanal o‘chirish', 'remove_channel'),
          Markup.button.callback('📋 Kanallar ro‘yxati', 'list_channels'),
        ],
        [
          Markup.button.callback('♻️ Kinoni tahrirlash', 'edit_movie'),
          Markup.button.callback('📊 Statistika', 'stats'),
          Markup.button.callback('📤 Xabar yuborish', 'broadcast'),
        ],
      ]),
    );
  });

  // 🔄 Kinoni tahrirlash
  bot.action('edit_movie', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    addState.set(id, { step: 'waiting_edit_code' });
    ctx.answerCbQuery();
    ctx.reply('✏️ Qaysi koddagi kinoni tahrirlaysiz? Kodni kiriting.');
  });

  bot.action('list_admins', async (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    ctx.answerCbQuery();

    if (admins.length === 0) {
      return ctx.reply('📭 Adminlar ro‘yxati bo‘sh.');
    }

    const list = admins
      .map(
        (adminId, index) =>
          `${index + 1}. [Admin](tg://user?id=${adminId}) — \`${adminId}\``,
      )
      .join('\n');

    ctx.replyWithMarkdownV2(`👥 *Adminlar ro‘yxati:*\n\n${list}`, {
      parse_mode: 'MarkdownV2',
    });
  });

  bot.action('remove_admin', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    addState.set(id, { step: 'waiting_remove_admin' });
    ctx.answerCbQuery();
    ctx.reply(
      '❌ O‘chirmoqchi bo‘lgan adminning Telegram ID raqamini yuboring:',
    );
  });

  bot.action('add_admin', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    addState.set(id, { step: 'waiting_new_admin' });
    ctx.answerCbQuery();
    ctx.reply('👤 Yangi adminning Telegram ID raqamini ni yuboring:');
  });

  bot.action('broadcast', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    addState.set(id, { step: 'waiting_broadcast_message' });
    ctx.answerCbQuery();
    ctx.reply('✉️ Yubormoqchi bo‘lgan xabaringizni yozing:');
  });

  bot.action('list_channels', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    ctx.answerCbQuery();

    if (requiredChannels.length === 0) {
      return ctx.reply('📭 Hech qanday kanal belgilanmagan.');
    }

    const list = requiredChannels.map((ch, i) => `${i + 1}. ${ch}`).join('\n');
    ctx.reply(`📋 Majburiy kanallar ro‘yxati:\n\n${list}`);
  });

  bot.action('add_channel', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    addState.set(id, { step: 'waiting_add_channel' });
    ctx.answerCbQuery();
    ctx.reply(
      '📥 Yangi kanalni username formatda yuboring (masalan: `@mychannel`)',
    );
  });

  bot.action('remove_channel', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    addState.set(id, { step: 'waiting_remove_channel' });

    const list =
      requiredChannels.map((ch, i) => `${i + 1}. ${ch}`).join('\n') ||
      '📭 Hozircha kanal yo‘q.';
    ctx.answerCbQuery();
    ctx.reply(
      `🗑 O‘chirish uchun kanalni username sifatida yuboring:\n\n${list}`,
    );
  });

  bot.action('stats', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    ctx.answerCbQuery();

    const statsMessage =
      `📊 *Statistika*\n\n` +
      `👥 Foydalanuvchilar: *${users.length}*\n` +
      `🎬 Kinolar: *${movies.length}*\n` +
      `🛠 Adminlar: *${admins.length}*`;

    ctx.replyWithMarkdown(statsMessage);
  });

  bot.action('view_movies', async (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    ctx.answerCbQuery();

    if (movies.length === 0) {
      return ctx.reply('📭 Kinolar ro‘yxati bo‘sh.');
    }

    // Har bir kinoni bitta qatorda chiqaramiz: KOD - Nomi
    const movieList = movies
      .map((m, i) => `${i + 1}. *${m.code}* — ${m.title}`)
      .slice(0, 100) // Faqat birinchi 10 ta (hozircha)
      .join('\n');

    ctx.replyWithMarkdown(`🎬 *Kinolar ro‘yxati (1–100)*\n\n${movieList}`);
  });

  // 🎛 Kino qo‘shish tugmasi
  bot.action('add_movie', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    addState.set(id, { step: 'waiting_code' });
    ctx.answerCbQuery();
    ctx.reply(
      '🔡 Iltimos, kod va kino nomini yuboring. Format:\n`KOD Kino nomi`',
      {
        parse_mode: 'Markdown',
      },
    );
  });

  bot.action('delete_movie', (ctx) => {
    const id = ctx.from?.id;
    if (!id || !admins.includes(id)) return;

    addState.set(id, { step: 'waiting_delete_code' });
    ctx.answerCbQuery();
    ctx.reply('🗑 O‘chirish uchun kino kodini yuboring.');
  });

  // Kod va nom
  bot.on('text', async (ctx, next) => {
    const id = ctx.from?.id;
    const state = addState.get(id || 0);

    if (state?.step === 'waiting_code') {
      const [code, ...titleParts] = ctx.message.text.trim().split(' ');
      const title = titleParts.join(' ');

      if (!code || !title) {
        return ctx.reply(
          '❌ Format noto‘g‘ri. To‘g‘ri format: `KOD Kino nomi`',
          { parse_mode: 'Markdown' },
        );
      }
      addState.set(id!, { step: 'waiting_video', code, title });
      return ctx.reply('🎥 Endi kinoni video fayl sifatida yuboring.');
    }

    // 🗑 Kino o‘chirish
    if (state?.step === 'waiting_delete_code') {
      const code = ctx.message.text.trim();
      const index = movies.findIndex((m) => m.code === code);

      if (index === -1) {
        return ctx.reply('❌ Bunday koddagi kino topilmadi.');
      }

      const removed = movies.splice(index, 1)[0];
      saveMovies();
      addState.delete(id!);

      return ctx.reply(
        `✅ Kino o‘chirildi: ${removed.title} (${removed.code})`,
      );
    }

    if (state?.step === 'waiting_add_channel') {
      const channel = ctx.message.text.trim();
      if (!channel.startsWith('@')) {
        return ctx.reply('❌ Noto‘g‘ri format. Masalan: `@mychannel`');
      }

      if (requiredChannels.includes(channel)) {
        return ctx.reply('⚠️ Bu kanal allaqachon qo‘shilgan.');
      }

      requiredChannels.push(channel);
      saveChannels();
      addState.delete(id!);
      return ctx.reply(`✅ Kanal qo‘shildi: ${channel}`);
    }

    if (state?.step === 'waiting_remove_channel') {
      const channel = ctx.message.text.trim();

      if (!requiredChannels.includes(channel)) {
        return ctx.reply('❌ Bunday kanal topilmadi.');
      }

      requiredChannels = requiredChannels.filter((ch) => ch !== channel);
      saveChannels();
      addState.delete(id!);
      return ctx.reply(`✅ Kanal o‘chirildi: ${channel}`);
    }

    if (state?.step === 'waiting_broadcast_message') {
      const message = ctx.message.text;
      let sent = 0;
      let failed = 0;

      for (const uid of users) {
        try {
          bot.telegram.sendMessage(uid, message);
          sent++;
        } catch (err) {
          failed++;
        }
      }

      ctx.reply(
        `✅ Xabar jo‘natildi: ${sent} ta\n❌ Yetkazib bo‘lmadi: ${failed} ta`,
      );
      addState.delete(id!);
      return;
    }

    if (state?.step === 'waiting_new_admin') {
      const input = ctx.message.text.trim();

      let newAdminId: number | undefined;

      // Agar faqat raqam bo‘lsa (ID bo‘lishi mumkin)
      if (/^\d+$/.test(input)) {
        newAdminId = parseInt(input);
      }

      if (!newAdminId) {
        return ctx.reply('❌ Noto‘g‘ri ID berildi.');
      }

      if (admins.includes(newAdminId)) {
        return ctx.reply('⚠️ Bu foydalanuvchi allaqachon admin.');
      }

      admins.push(newAdminId);
      writeFileSync(adminsPath, JSON.stringify(admins, null, 2), 'utf8');
      addState.delete(ctx.from.id);

      return ctx.reply(`✅ Admin muvaffaqiyatli qo‘shildi! ID: ${newAdminId}`);
    }

    if (state?.step === 'waiting_remove_admin') {
      const input = ctx.message.text.trim();

      if (!/^\d+$/.test(input)) {
        return ctx.reply('❌ Faqat raqamli Telegram ID yuboring.');
      }

      const adminId = parseInt(input);

      if (!admins.includes(adminId)) {
        return ctx.reply('⚠️ Bunday IDdagi admin topilmadi.');
      }

      admins = admins.filter((a) => a !== adminId);
      writeFileSync(adminsPath, JSON.stringify(admins, null, 2), 'utf8');
      addState.delete(ctx.from.id);

      return ctx.reply(`✅ Admin muvaffaqiyatli o‘chirildi! ID: ${adminId}`);
    }

    if (state?.step === 'waiting_edit_code') {
      const code = ctx.message.text.trim();
      const movie = movies.find((m) => m.code === code);

      if (!movie) {
        return ctx.reply('❌ Bunday koddagi kino topilmadi.');
      }

      addState.set(id!, {
        step: 'waiting_edit_code',
        code,
        title: movie.title,
      });
      return ctx.reply(`🎥 Yangi videoni yuboring: *${movie.title}*`, {
        parse_mode: 'Markdown',
      });
    }

    return next(); // boshqa textlarga o'tkazish
  });

  // Kino videoni qabul qilish
  bot.on('video', (ctx) => {
    const id = ctx.from?.id;
    const state = addState.get(id || 0);

    // 🎬 Kino qo‘shish holati
    if (state?.step === 'waiting_video' && state.code && state.title) {
      const file_id = ctx.message.video.file_id;

      movies.push({ code: state.code, title: state.title, file_id });
      saveMovies();

      addState.delete(id!);

      return ctx.reply(`✅ Kino saqlandi: ${state.title} (${state.code})`);
    }

    // ♻️ Kino tahrirlash holati
    if (state?.step === 'waiting_edit_code' && state.code) {
      const index = movies.findIndex((m) => m.code === state.code);
      if (index === -1) {
        return ctx.reply('❌ Kino topilmadi.');
      }

      // video yangilash
      movies[index].file_id = ctx.message.video.file_id;
      saveMovies();

      addState.delete(id!);

      return ctx.reply(
        `✅ Kino yangilandi: ${movies[index].title} (${movies[index].code})`,
      );
    }
  });
}

export function findMovieByCode(code: string): Movie | undefined {
  return movies.find((m) => m.code === code);
}

export { users, saveUsers };
