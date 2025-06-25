import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotService } from './bot/bot.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const botService = app.get(BotService);
  await botService.launch(); // Telegraf botni ishga tushurish

  console.log('🤖 Bot ishga tushdi');

  // Graceful shutdown
  process.once('SIGINT', () => botService.stop('SIGINT'));
  process.once('SIGTERM', () => botService.stop('SIGTERM'));
}
bootstrap();
