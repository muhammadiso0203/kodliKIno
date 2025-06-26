import { Telegraf, Context, Markup } from 'telegraf';
import { Movie } from 'src/entity/MovieEntity';
import { Repository } from 'typeorm';

interface State {
  step:
    | 'waiting_code'
    | 'waiting_video'
    | 'waiting_edit_code'
    | 'waiting_delete_code';
  code?: string;
  title?: string;
}

const addState = new Map<number, State>();

export function setupAdminPanel(bot: Telegraf, movieRepo: Repository<Movie>) {
  bot.command('admin', (ctx) => {
    const id = ctx.from?.id;
    if (id !== Number(process.env.ADMIN_ID)) return;

    ctx.reply(
      '🎬 Admin panel',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Qo‘shish', 'add_movie')],
        [Markup.button.callback('♻️ Tahrirlash', 'edit_movie')],
        [Markup.button.callback('📋 Kinolar ro‘yxati', 'view_movies')],
        [Markup.button.callback('🗑 Kino o‘chirish', 'delete_movie')],
      ]),
    );
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
}
